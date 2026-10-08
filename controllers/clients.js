const Client = require("../models/Client");
const WorkDayList = require("../models/WorkDayList");
const Geo = require("../utils/geocode");
const { readServiceHistory } = require("../utils/serviceHistory");

module.exports = {
  getClient: async (req, res) => {
    try {
      const client = await Client.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });
      if (!client) {
        return res.status(404).send("Client not found");
      }
      const serviceHistory = readServiceHistory(client.serviceHistory);
      res.render("client.ejs", {
        clientData: client,
        user: req.user,
        serviceHistory,
        frequencies: Client.FREQUENCIES,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  },

  createClient: async (req, res) => {
    const { clientName, clientPhone, clientAddress, clientFrequency } =
      req.body;
    try {
      const { lat, lng } = await Geo.geocodeAddress(clientAddress);
      await Client.create({
        name: clientName,
        phone: clientPhone,
        address: clientAddress,
        completed: false,
        userId: req.user.id,
        frequency: clientFrequency,
        lat,
        lng,
      });
      console.log("new client has been added!");
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Create client failed:", err.message);
      res.redirect("/dashboard");
    }
  },

  updateClient: async (req, res) => {
    const {
      clientId,
      clientName,
      clientPhone,
      clientAddress,
      clientFrequency,
    } = req.body;
    try {
      const { lat, lng } = await Geo.geocodeAddress(clientAddress);
      await Client.findOneAndUpdate(
        { _id: clientId, userId: req.user.id },
        {
          name: clientName,
          phone: clientPhone,
          address: clientAddress,
          frequency: clientFrequency,
          lat,
          lng,
        },
        // updates skip schema validation by default, which would let any
        // posted frequency through
        { runValidators: true },
      );
      // the address may have moved, so saved routes through it are stale
      await WorkDayList.updateMany(
        { userId: req.user.id, clientIds: clientId },
        { $unset: { route: 1 } },
      );
      console.log("Client has been updated!");
      res.redirect(`/clients/${clientId}`);
    } catch (err) {
      console.error("Update failed:", err.message);
      res.status(500).json({ error: "Could not update client." });
    }
  },

  deleteClient: async (req, res) => {
    try {
      await Client.findOneAndDelete({
        _id: req.body.clientIdFromJSFile,
        userId: req.user.id,
      });
      await WorkDayList.updateMany(
        { userId: req.user.id, clientIds: req.body.clientIdFromJSFile },
        // a saved route no longer matches a list that lost a stop
        {
          $pull: { clientIds: req.body.clientIdFromJSFile },
          $unset: { route: 1 },
        },
      );
      console.log("Deleted Client");
      res.redirect("/profile");
    } catch (err) {
      console.error(err);
      req.flash("errors", { msg: "Could not delete client." });
      res.redirect("/profile");
    }
  },
};
