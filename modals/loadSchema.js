  const mongoose = require('mongoose');

  const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  });

  const Counter = mongoose.model("Counter", counterSchema);

  const publishLoadSchema = new mongoose.Schema(
    {
      loadId: { type: String, unique: true, index: true },
      //location
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "userData",
        required: true
      },

      from: {
        city: { type: String, required: true },
        address: { type: String, required: true }, // city/place name
        location: {
          type: {
            type: String,
            enum: ["Point"],
            required: true,
            default: "Point"
          },
          coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
          }
        }
      },

      to: {
        city: { type: String, required: true },
        address: { type: String, required: true },
        location: {
          type: {
            type: String,
            enum: ["Point"],
            required: true,
            default: "Point"
          },
          coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
          }
        }
      },

      //load
      amount: { type: String, required: true },
      loadType: { type: String, required: true },
      capacity: { type: String, required: true },
      truckType: { type: String, required: true },
      bodyType: { type: String, required: true},
      wheelers: { type: String },
      distanceText: { type: String },
      durationText: { type: String },
      scheduleDateTime: { type: Date, required: true },
      LoadImage: {
        url: {
          type: String,
          default: null
        },
        publicId: {
          type: String,
          default: null
        }
      },
      status: { type: String, default: "Active" },// active, cancelled or expired
      viewedBy: [{ type: mongoose.Schema.Types.ObjectId }],

      //contact
      receiverNo: { type: String, required: true },
      receiverName: { type: String, required: true },
      rejectionReason: {
        type: String,
        default: null
      },
      reportCount: { type: Number, default: 0 },
      isBlocked: { type: Boolean, default: false },

      approvedAt: Date,
      rejectedAt: Date
    },
    { timestamps: true }
  );

  publishLoadSchema.index({ "from.location": "2dsphere" });
  publishLoadSchema.index({ "to.location": "2dsphere" });

  publishLoadSchema.pre("save", async function () {
    try {
      if (this.loadId) return;

      const counter = await Counter.findOneAndUpdate(
        { name: "loadId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.loadId = `LD-${String(counter.seq).padStart(8, "0")}`;
    } catch (err) {
      next(err);
    }
  });
  const PublishLoad = mongoose.model('publishLoad', publishLoadSchema);

  module.exports = { PublishLoad };