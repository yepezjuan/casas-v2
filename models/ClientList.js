const mongoose = require("mongoose");

const ClientListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  clientIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
  ],
});

module.exports = mongoose.model("ClientList", ClientListSchema);
