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
        "Active",
        "Pending",
        "Approved",
        "StartedTrip",
        "ReachedPickup",
        "PickedUp",
        "InTransit",
        "Delivered",
        "Completed",
        "Cancelled",
        "Expired"
      ],
      default: "Active"
    },

    // lifecycle timestamps
    scheduledAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    startedTripAt: { type: Date, default: null },
    reachedPickupAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // reached pickup proof
    reachedPickupProof: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      at: { type: Date, default: null }
    },

    // pickup proof
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
      enum: ["TruckOwner", "Transporter"],
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
    },
    pendingExpiresAt: { type: Date },
    pendingReminderSent: { type: Boolean, default: false },

  },
  { timestamps: true }
);

// indexes
loadBookingSchema.index({ loadId: 1, bookedBy: 1 }, { unique: true });
loadBookingSchema.index({ driverLocation: "2dsphere" });

const LoadBooking = mongoose.model("LoadBooking", loadBookingSchema);

module.exports = { LoadBooking };
