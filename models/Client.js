const mongoose = require("mongoose");
const { required } = require("nodemon/lib/config");

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
  day: {
    type: String,
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

  completed: {
    type: Boolean,
    required: true,
  },
});

module.exports = mongoose.model("Client", ClientSchema);
