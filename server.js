const express = require("express");
const app = express();
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const methodOverride = require("method-override");
const flash = require("express-flash");
const logger = require("morgan");
const connectDB = require("./config/database");
const mainRoutes = require("./routes/main");
const dashboard = require("./routes/dashboard");
const clients = require("./routes/clients");
const workDayList = require("./routes/workDayList");

//Use .env file in config folder
require("dotenv").config({ path: "./config/.env" });

// Passport config
require("./config/passport")(passport);

//Connect To Database
connectDB();

//Using EJS for views
app.set("view engine", "ejs");

//Static Folder
app.use(express.static("public"));

//Body Parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Logging
app.use(logger("dev"));

//Use forms for put / delete
app.use(methodOverride("_method"));

// the host's HTTPS proxy sits in front of the app. without this, req.secure is
// false, so secure cookies are never set, and every visitor shares the proxy's
// IP for rate limiting
app.set("trust proxy", 1);

// Setup Sessions - stored in MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // local dev runs on plain http
      secure: process.env.NODE_ENV === "production",
      // not sent on cross-site POSTs, so another site can't submit forms here
      // on a logged-in user's behalf
      sameSite: "lax",
      // matches connect-mongo's 14-day session expiry
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
  }),
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

//Use flash messages for errors, info, ect...
app.use(flash());

//Setup Routes For Which The Server Is Listening
app.use("/", mainRoutes);
app.use("/dashboard", dashboard);
app.use("/clients", clients);
app.use("/workDayList", workDayList);

// Last resort for anything a route did not handle. The stack goes to the server
// log only, never to the page. req.body is not logged: it can hold a password
// or a home address
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode;
  const code = status >= 400 && status < 500 ? status : 500;
  if (code === 500) console.error(err);
  res.status(code).render("error", { code });
});

//Server Running
app.listen(process.env.PORT, () => {
  console.log("Server is running, you better catch it!");
});
