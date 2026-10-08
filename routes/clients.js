const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clients");
const { ensureAuth } = require("../middleware/auth");

router.get("/:id", ensureAuth, clientsController.getClient);

router.post("/createClient", ensureAuth, clientsController.createClient);

router.put("/updateClient", ensureAuth, clientsController.updateClient);

router.delete("/deleteClient", ensureAuth, clientsController.deleteClient);

module.exports = router;
