const workDayList = require("../models/WorkDayList");
const Client = require("../models/Client");
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
    const { clientIds, date } = req.body;
    try {
      await workDayList.create({
        userId: req.user.id,
        clientIds: clientIds,
        date: date,
      });
      res.redirect("/dashboard");
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not create workday list." });
    }
  },
};
