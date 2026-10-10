const passport = require("passport");
const validator = require("validator");
const Client = require("../models/Client");
const User = require("../models/User");
const WorkDayList = require("../models/WorkDayList");
const { geocodeAddress } = require("../utils/geocode");
const { readServiceHistory } = require("../utils/serviceHistory");

const START_ADDRESS_INVALID =
  "Please enter a starting address (5 to 200 characters).";

// the posted starting address, trimmed, or null if it is missing, not a string
// (a form can post an array or object) or an unreasonable length
function readStartAddress(body) {
  if (typeof body.startAddress !== "string") return null;
  const address = body.startAddress.trim();
  return address.length >= 5 && address.length <= 200 ? address : null;
}

// logs a failed lookup and returns the message to show. the address itself is
// deliberately not logged
function startAddressLookupError(err) {
  console.error("Start address lookup failed:", err.message);
  return err.code === "NO_RESULTS"
    ? "We couldn't find that address. Check it and try again."
    : "Address lookup is unavailable right now. Try again in a moment.";
}

// saved totals were measured from the old starting point
function clearSavedRoutes(userId) {
  return WorkDayList.updateMany({ userId }, { $unset: { route: 1 } });
}

exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect("/dashboard");
  }
  res.render("login", {
    title: "Login",
  });
};

exports.getProfile = async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user.id });

    // newest past visit per client, same window as the client page
    const lastServiced = {};
    clients.forEach((c) => {
      lastServiced[c._id] = readServiceHistory(c.serviceHistory)[0];
    });

    res.render("profile", {
      user: req.user,
      clients,
      lastServiced,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: "Password cannot be blank." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/login");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("errors", info);
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Success! You are logged in." });

      res.redirect(req.session.returnTo || "/dashboard");
    });
  })(req, res, next);
};

exports.logout = (req, res) => {
  req.logout(() => {
    console.log("User has logged out.");
  });
  req.session.destroy((err) => {
    if (err)
      console.log("Error : Failed to destroy the session during logout.", err);
    req.user = null;
    res.redirect("/");
  });
};

exports.getSignup = (req, res) => {
  if (req.user) {
    //TODO: CHANGE THIS BACK TO PROFILE ONCE I MAKE A PROFILE
    return res.redirect("/dashboard");
  }
  res.render("signup", {
    title: "Create Account",
  });
};

exports.postSignup = async (req, res, next) => {
  try {
    const validationErrors = [];
    if (!validator.isEmail(req.body.email))
      validationErrors.push({ msg: "Please enter a valid email address." });
    if (!validator.isLength(req.body.password, { min: 8 }))
      validationErrors.push({
        msg: "Password must be at least 8 characters long",
      });
    if (req.body.password !== req.body.confirmPassword)
      validationErrors.push({ msg: "Passwords do not match" });
    const startAddress = readStartAddress(req.body);
    if (!startAddress) validationErrors.push({ msg: START_ADDRESS_INVALID });

    if (validationErrors.length) {
      req.flash("errors", validationErrors);
      return res.redirect("../signup");
    }
    req.body.email = validator.normalizeEmail(req.body.email, {
      gmail_remove_dots: false,
    });

    const existingUser = await User.findOne({
      $or: [{ email: req.body.email }, { userName: req.body.userName }],
    });
    if (existingUser) {
      req.flash("errors", {
        msg: "Account with that email address or username already exists.",
      });
      return res.redirect("../signup");
    }

    // last, so a signup rejected above never costs a Google request
    let start;
    try {
      start = await geocodeAddress(startAddress);
    } catch (err) {
      req.flash("errors", { msg: startAddressLookupError(err) });
      return res.redirect("../signup");
    }

    const user = new User({
      userName: req.body.userName,
      email: req.body.email,
      password: req.body.password,
      startAddress: start.formattedAddress,
      startLat: start.lat,
      startLng: start.lng,
    });
    await user.save();

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      // TODO: route to the dashboard
      res.redirect("/dashboard");
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStartAddress = async (req, res) => {
  const startAddress = readStartAddress(req.body);
  if (!startAddress) {
    req.flash("errors", { msg: START_ADDRESS_INVALID });
    return res.redirect("/profile");
  }

  try {
    // the form is prefilled with the saved address, so an untouched save
    // should not cost a Google request
    if (startAddress !== req.user.startAddress) {
      let start;
      try {
        start = await geocodeAddress(startAddress);
      } catch (err) {
        req.flash("errors", { msg: startAddressLookupError(err) });
        return res.redirect("/profile");
      }

      req.user.startAddress = start.formattedAddress;
      req.user.startLat = start.lat;
      req.user.startLng = start.lng;
      await req.user.save();
      await clearSavedRoutes(req.user.id);
    }

    req.flash("success", { msg: "Starting address saved." });
    res.redirect("/profile");
  } catch (err) {
    console.error("Start address update failed:", err.message);
    req.flash("errors", { msg: "Could not save your starting address." });
    res.redirect("/profile");
  }
};

exports.deleteStartAddress = async (req, res) => {
  try {
    req.user.startAddress = undefined;
    req.user.startLat = undefined;
    req.user.startLng = undefined;
    await req.user.save();
    await clearSavedRoutes(req.user.id);

    req.flash("success", { msg: "Starting address removed." });
    res.redirect("/profile");
  } catch (err) {
    console.error("Start address removal failed:", err.message);
    req.flash("errors", { msg: "Could not remove your starting address." });
    res.redirect("/profile");
  }
};
