const workDayList = require("../models/WorkDayList");
const Client = require("../models/Client");

const serviceHistory = require("../utils/serviceHistory");
const Routing = require("../utils/routing");

// mongoose 5's isValidObjectId accepts any 12-char string, which would still
// throw a CastError inside $in, so check the hex form directly
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// narrows posted ids to clients this user owns, keeping submit order and
// dropping duplicates. foreign, deleted and malformed ids are silently left out
// so a stale form (client deleted on another device) still saves what it can
async function ownedClientIds(rawIds, userId) {
  const ids = [...new Set([].concat(rawIds || []).map(String))].filter((id) =>
    OBJECT_ID.test(id),
  );
  if (ids.length == 0) return [];

  const owned = await Client.find({ _id: { $in: ids }, userId }).distinct(
    "_id",
  );
  const ownedSet = new Set(owned.map(String));

  return ids.filter((id) => ownedSet.has(id));
}

// what the dashboard needs to draw a list: its clients in the list's own order
// ($in returns them in storage order) plus the saved route, if it has one
async function listPayload(list, user) {
  const docs = await Client.find({
    userId: user.id,
    _id: { $in: list.clientIds },
  });
  const byId = new Map(docs.map((c) => [String(c._id), c]));
  const clients = list.clientIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean);

  // mongoose hydrates a nested path as {} even when unset, so test a field
  const saved = list.route && list.route.optimizedAt ? list.route : null;
  const route = saved
    ? {
        miles: (saved.distanceMeters / 1609.344).toFixed(1),
        minutes: Math.round(saved.durationSeconds / 60),
        // rebuilt on read so it follows the user's current starting point
        deepLink: Routing.buildDeepLink(Routing.resolveOrigin(user), clients),
      }
    : null;

  // why does this have a name when lists dont have a name
  return { name: list.name, listId: list._id, clients, route };
}

module.exports = {
  getListClients: async (req, res) => {
    // Mongoose strips an undefined filter value, so an unvalidated date would
    // degrade the query to { userId } and answer with an arbitrary date's list.
    // An object param (?date[$ne]=null) casts cleanly and does the same.
    const date = serviceHistory.toDateKey(req.query.date);
    if (!date) {
      return res.status(400).json({ error: "A YYYY-MM-DD date is required." });
    }

    try {
      const list = await workDayList.findOne({
        date: date,
        userId: req.user.id,
      });
      if (!list) {
        return res.status(404).json({ error: "List not found." });
      }
      res.json(await listPayload(list, req.user));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load list." });
    }
  },

  createList: async (req, res) => {
    // only a bare "YYYY-MM-DD" keeps one-list-per-day meaningful: the unique
    // index compares the stored Date exactly, so a date carrying a time would
    // land beside an existing midnight list instead of replacing it
    const date = serviceHistory.toDateKey(req.body.date);
    if (!date) {
      return res.status(400).json({ error: "A YYYY-MM-DD date is required." });
    }
    try {
      // a single checked box arrives as a string, none as undefined
      const clientIds = await ownedClientIds(req.body.clientIds, req.user.id);
      const filter = { userId: req.user.id, date: date };
      const fields = { userId: req.user.id, clientIds: clientIds, date: date };

      try {
        await workDayList.findOneAndUpdate(filter, fields, {
          upsert: true,
          setDefaultsOnInsert: true,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        // two submits raced and the unique index rejected this one's insert.
        // the winner's list exists now, so the same write lands as an update
        await workDayList.findOneAndUpdate(filter, fields);
      }

      await serviceHistory.recordServiceHistory(clientIds, req.user.id, date);
      res.redirect("/dashboard");
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not create workday list." });
    }
  },

  updateList: async (req, res) => {
    const { listId } = req.body;
    if (!listId) {
      return res.status(400).json({ error: "listId required." });
    }

    try {
      const list = await workDayList.findOne({
        _id: listId,
        userId: req.user.id,
      });
      if (!list) {
        return res.status(404).json({ error: "List not found." });
      }

      // the list's own date is authoritative, not whatever the form posted
      const dateKey = list.date.toISOString().slice(0, 10);

      const nextIds = await ownedClientIds(req.body.clientIds, req.user.id);

      // list.clientIds holds ObjectIds, nextIds holds strings
      const prevIds = list.clientIds.map((id) => id.toString());
      const keep = new Set(nextIds);
      const removedIds = prevIds.filter((id) => !keep.has(id));

      // unchecking everything deletes the list for that date
      if (nextIds.length == 0) {
        await serviceHistory.clearServiceHistory(prevIds, req.user.id, dateKey);
        await list.deleteOne();
        return res.redirect("/dashboard");
      }

      // an untouched save keeps the optimized order; any real change to the
      // clients makes the saved route stale
      const changed =
        removedIds.length > 0 || nextIds.length !== prevIds.length;
      if (changed) {
        list.clientIds = nextIds;
        list.route = undefined;
        await list.save();
      }

      await serviceHistory.clearServiceHistory(
        removedIds,
        req.user.id,
        dateKey,
      );
      await serviceHistory.recordServiceHistory(nextIds, req.user.id, dateKey);

      res.redirect("/dashboard");
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not update workday list." });
    }
  },

  optimizeList: async (req, res) => {
    const { listId } = req.body;
    if (typeof listId !== "string" || !OBJECT_ID.test(listId)) {
      return res.status(400).json({ error: "listId required." });
    }

    try {
      const list = await workDayList.findOne({
        _id: listId,
        userId: req.user.id,
      });
      if (!list) {
        return res.status(404).json({ error: "List not found." });
      }
      if (list.clientIds.length < 2) {
        return res
          .status(400)
          .json({ error: "A route needs at least 2 clients." });
      }

      let result;
      try {
        result = await Routing.getRouteForClientIds(
          list.clientIds,
          req.user.id,
          Routing.resolveOrigin(req.user),
        );
      } catch (err) {
        console.error("Route optimization failed:", err.message);
        // err.status marks a problem with the list itself, whose message is
        // safe to show; anything else is Google or the network
        return err.status
          ? res.status(err.status).json({ error: err.message })
          : res.status(502).json({
              error: "Could not reach the routing service. Try again.",
            });
      }

      list.clientIds = result.orderedClients.map((c) => c.id);
      list.route = {
        distanceMeters: result.totalDistanceMeters,
        durationSeconds: result.totalDurationSeconds,
        optimizedAt: new Date(),
      };
      await list.save();

      res.json(await listPayload(list, req.user));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not optimize route." });
    }
  },

  getScheduledDates: async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(404).json({ error: "start and end required" });
    }

    try {
      const lists = await workDayList.find(
        {
          userId: req.user.id,
          date: { $gte: new Date(start), $lt: new Date(end) },
        },
        { date: 1, _id: 0 },
      );

      const dates = lists.map((l) => l.date.toISOString().slice(0, 10));
      res.json({ dates });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not load scheduled dates." });
    }
  },
};
