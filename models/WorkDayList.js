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
  // set by the optimizer. while present, clientIds is in optimized visit order;
  // cleared whenever the list's clients or their addresses change
  route: {
    distanceMeters: Number,
    durationSeconds: Number,
    optimizedAt: Date,
  },
});

// one list per user per day. unique is what makes the upsert in
// controllers/workDayList.js atomic: without it two racing submits can both
// insert, leaving an unreachable orphan behind findOne. also helps pull dates
// quicker.
WorkDayListSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("WorkDayList", WorkDayListSchema);
