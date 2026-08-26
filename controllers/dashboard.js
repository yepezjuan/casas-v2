// TODO: add requests for current day client list
// TODO: addd request for custom lists (most recent first)

module.exports = {
  getDashboard: (req, res) => {
    res.render("dashboard.ejs");
  },
};
