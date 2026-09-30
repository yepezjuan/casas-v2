const workDayList = require("../models/WorkDayList");
const Client = require("../models/Client");

const serviceHistory = require("../utils/serviceHistory");
const Routing = require("../utils/routing");

module.exports = {
  getListClients: async (req, res) => {
    try {
      const list = await workDayList.findOne({
        // dont think we need to search by _id
        date: req.query.date,
        userId: req.user.id,
      });
      if (!list) {
        return res.status(404).json({ error: "List not found." });
      }
      const clients = await Client.find({
        userId: req.user.id,
        _id: { $in: list.clientIds },
      });
      res.json({ name: list.name, clients });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load list." });
    }
  },

  createList: async (req, res) => {
    const { date } = req.body;
    // a single checked box arrives as a string, none as undefined
    const clientIds = [].concat(req.body.clientIds || []);

    try {
      await workDayList.create({
        userId: req.user.id,
        clientIds: clientIds,
        date: date,
      });
      await serviceHistory.recordServiceHistory(clientIds, req.user.id, date);
      res.redirect("/dashboard");
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not create workday list." });
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
