const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const homeController = require("../controllers/home");
const { ensureAuth, ensureGuest } = require("../middleware/auth");
const {
  signupLimiter,
  loginLimiter,
  startAddressLimiter,
} = require("../middleware/rateLimit");

//Main Routes - simplified for now
router.get("/", homeController.getIndex);
router.get("/profile", ensureAuth, authController.getProfile);
router.put(
  "/profile/startAddress",
  ensureAuth,
  startAddressLimiter,
  authController.updateStartAddress,
);
router.delete(
  "/profile/startAddress",
  ensureAuth,
  authController.deleteStartAddress,
);
router.get("/login", authController.getLogin);
router.post("/login", loginLimiter, authController.postLogin);
router.get("/logout", authController.logout);
router.get("/signup", authController.getSignup);
router.post("/signup", signupLimiter, authController.postSignup);

module.exports = router;
