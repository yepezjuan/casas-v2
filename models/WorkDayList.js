const mongoose = require("mongoose");

const WorkDayListSchema = new mongoose.Schema({
  name: {
    //not using names just yet will require when using for template lists
    type: String,
    required: false,
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
  date: {
    type: Date,
    required: true,
  },
});

WorkDayListSchema.index({ userId: 1, date: 1 });
// helps pull dates quicker

module.exports = mongoose.model("WorkDayList", WorkDayListSchema);
