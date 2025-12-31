const mongoose = require('mongoose');

const loadBookingSchema = new mongoose.Schema(
  {
    loadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "publishLoad",
      required: true
    },

    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "cancelled"],
      default: "pending"
    },

    cancelledBy: {
      type: String,
      enum: ["owner", "booker"]
    },
    distanceText: { type: String },
    durationText: { type: String },
  },
  { timestamps: true }
);

const LoadBooking = mongoose.model("LoadBooking", loadBookingSchema);

module.exports = {LoadBooking}