// TODO: add requests for current day client list
// TODO: addd request for custom lists (most recent first)
const Client = require("../models/Client");
module.exports = {
  getDashboard: async (req, res) => {
    try {
      const clients = await Client.find({ userId: req.user.id });
      res.render("dashboard.ejs", { clients, user: req.user });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  },
};
