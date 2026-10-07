const express = require("express");
const router = express.Router();
const WorkDayListController = require("../controllers/workDayList");
const { ensureAuth } = require("../middleware/auth");

router.get("/", ensureAuth, WorkDayListController.getListClients);
router.post("/", ensureAuth, WorkDayListController.createList);
router.get("/dates", ensureAuth, WorkDayListController.getScheduledDates);
router.post("/optimize", ensureAuth, WorkDayListController.optimizeList);

router.put("/", ensureAuth, WorkDayListController.updateList);

module.exports = router;
