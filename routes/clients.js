const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clients");
const { ensureAuth } = require("../middleware/auth");

router.get("/", ensureAuth, clientsController.getClients);

router.get("/edit/:id", ensureAuth, clientsController.getEdit);

router.get("/route/:day", ensureAuth, clientsController.getRoute);

router.post("/createClient", ensureAuth, clientsController.createClient);

router.put("/updateClient", ensureAuth, clientsController.updateClient);

router.delete("/deleteClient", ensureAuth, clientsController.deleteClient);

module.exports = router;
