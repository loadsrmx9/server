const mongoose = require("mongoose");

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

    // booking flow status
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "confirm",
        "picked_up",
        "in_transit",
        "delivered",
        "completed",
        "cancelled",
        "expired"
      ],
    },

    // lifecycle timestamps
    scheduledAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // pickup proof (location validation record)
    pickupProof: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      at: { type: Date, default: null }
    },

    // delivered proof
    deliveryProof: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      at: { type: Date, default: null }
    },

    // cancelled info
    cancelledBy: {
      type: String,
      enum: ["owner", "booker"],
      default: null
    },
    cancelledAt: { type: Date, default: null },

    // distance from driver to pickup when booking
    distanceText: { type: String, default: null },
    durationText: { type: String, default: null },

    // live tracking (store last driver location)
    driverLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
    }
  },
  { timestamps: true }
);

// indexes
loadBookingSchema.index({ loadId: 1, bookedBy: 1 });
loadBookingSchema.index({ driverLocation: "2dsphere" });

const LoadBooking = mongoose.model("LoadBooking", loadBookingSchema);

module.exports = { LoadBooking };
