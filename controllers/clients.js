const Client = require("../models/Client");
const ClientList = require("../models/ClientList");
const Geo = require("../utils/geocode");
const Routing = require("../utils/routing");

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

module.exports = {
  getClients: async (req, res) => {
    console.log(req.user);
    try {
      const clients = await Client.find({ userId: req.user.id });
      const mondayClients = await Client.find({
        userId: req.user.id,
        day: "Monday",
      });
      const tuesdayClients = await Client.find({
        userId: req.user.id,
        day: "Tuesday",
      });
      const wednesdayClients = await Client.find({
        userId: req.user.id,
        day: "Wednesday",
      });
      const thursdayClients = await Client.find({
        userId: req.user.id,
        day: "Thursday",
      });
      const fridayClients = await Client.find({
        userId: req.user.id,
        day: "Friday",
      });
      const saturdayClients = await Client.find({
        userId: req.user.id,
        day: "Saturday",
      });
      const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

      let todayRoute = null;
      if (VALID_DAYS.includes(today)) {
        try {
          const result = await Routing.getRouteForDay(today, req.user.id);
          const clock = (d) =>
            new Date(d).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
          todayRoute = {
            schedule: result.schedule.map((s) => ({
              name: s.name,
              arrive: clock(s.arrive),
              depart: clock(s.depart),
            })),
            miles: (result.totalDistanceMeters / 1609.344).toFixed(1),
            minutes: Math.round(result.totalDurationSeconds / 60),
            deepLink: result.deepLink,
          };
        } catch (err) {
          todayRoute = { error: err.message };
        }
      }

      res.render("dashboard.ejs", {
        clients,
        mondayClients,
        tuesdayClients,
        wednesdayClients,
        thursdayClients,
        fridayClients,
        saturdayClients,
        today,
        validDays: VALID_DAYS,
        todayRoute,
        user: req.user,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  },

  getClient: async (req, res) => {
    try {
      const client = await Client.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });
      if (!client) {
        return res.status(404).send("Client not found");
      }
      res.render("client.ejs", { clientData: client, user: req.user });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  },

  getEdit: async (req, res) => {
    try {
      const client = await Client.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });
      res.render("edit.ejs", { client, user: req.user });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  },

  createClient: async (req, res) => {
    const { clientName, clientPhone, clientAddress, clientDay } = req.body;
    try {
      const { lat, lng } = await Geo.geocodeAddress(clientAddress);
      await Client.create({
        name: clientName,
        phone: clientPhone,
        address: clientAddress,
        completed: false,
        userId: req.user.id,
        day: clientDay,
        lat,
        lng,
      });
      console.log("new client has been added!");
      res.redirect("/clients");
    } catch (err) {
      console.error("Geocoding failed:", err.message);
      res.redirect("/clients");
    }
  },

  updateClient: async (req, res) => {
    const { clientId, clientName, clientPhone, clientAddress, clientDay } =
      req.body;
    try {
      const { lat, lng } = await Geo.geocodeAddress(clientAddress);
      await Client.findOneAndUpdate(
        { _id: clientId, userId: req.user.id },
        {
          name: clientName,
          phone: clientPhone,
          address: clientAddress,
          day: clientDay,
          lat,
          lng,
        },
      );
      console.log("Client has been updated!");
      res.json("Updated it");
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
      await ClientList.updateMany(
        { userId: req.user.id },
        { $pull: { clientIds: req.body.clientIdFromJSFile } },
      );
      console.log("Deleted Client");
      res.redirect("/profile");
    } catch (err) {
      console.error(err);
      req.flash("errors", { msg: "Could not delete client." });
      res.redirect("/profile");
    }
  },

  getRoute: async (req, res) => {
    const { day } = req.params;
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({ error: "Invalid day." });
    }
    try {
      const result = await Routing.getRouteForDay(day, req.user.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
