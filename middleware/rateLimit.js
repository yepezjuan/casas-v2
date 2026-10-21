const { rateLimit } = require("express-rate-limit");

// signup is open to anyone and each successful one costs a Geocoding request.
// counted per IP, which behind a host's proxy needs `trust proxy` set
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("errors", {
      msg: "Too many signup attempts. Try again in 15 minutes.",
    });
    res.status(429).render("signup", { title: "Create Account" });
  },
});

// caps password guessing. counted per IP like signup, so it also needs
// `trust proxy`
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("errors", {
      msg: "Too many login attempts. Try again in 15 minutes.",
    });
    res.status(429).render("login", { title: "Login" });
  },
});

// each change is one Geocoding request. mount after ensureAuth
const startAddressLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: (req, res) => {
    req.flash("errors", {
      msg: "Too many address changes. Try again in an hour.",
    });
    res.redirect("/profile");
  },
});

module.exports = { signupLimiter, loginLimiter, startAddressLimiter };
