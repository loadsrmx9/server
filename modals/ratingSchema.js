const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoadBooking",
      required: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true,
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    review: {type:String},
    role: { type: String, enum: ["Transporter", "TruckOwner"] },
  },
  { timestamps: true }
);

ratingSchema.index({ bookingId: 1, fromUser: 1 }, { unique: true });

const Rating = mongoose.model("Rating", ratingSchema);
module.exports = { Rating };
