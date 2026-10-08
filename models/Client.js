const mongoose = require("mongoose");

// stored value -> label shown in forms and lists
const FREQUENCIES = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

const ClientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },

  completed: {
    type: Boolean,
    required: true,
  },

  userId: {
    type: String,
    required: true,
  },
  // legacy: the weekday a client used to be pinned to. no longer read or
  // written, kept only so existing clients don't lose it
  day: {
    type: String,
  },
  // how often the client is visited. a string rather than a day count because
  // "monthly" isn't a fixed number of days
  frequency: {
    type: String,
    enum: Object.keys(FREQUENCIES),
    default: "weekly",
    required: true,
  },

  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
  serviceHistory: {
    type: [String], // "YYYY-MM-DD"
    default: [],
  },
});

const Client = mongoose.model("Client", ClientSchema);
Client.FREQUENCIES = FREQUENCIES;

module.exports = Client;
