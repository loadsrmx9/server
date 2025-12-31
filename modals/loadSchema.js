const mongoose = require('mongoose');


const publishLoadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true
    },

    from: {
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

    amount: { type: Number, required: true },
    loadType: { type: String },
    capacity: { type: String },
    truckType: { type: String },
    company: { type: String, required: true },
    phoneNo: { type: String, required: true },
    alternativeNo: { type: String },
    userPhone: { type: String },
    scheduleDate: { type: Date, required: true },

    distanceText: { type: String },
    durationText: { type: String },

    expireAt: { type: Date },
    status: { type: String, default: "active" }, // active | completed | deleted
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId }]
  },
  { timestamps: true }
);

publishLoadSchema.pre("save", function (next) {
  if (this.isModified("scheduleDate")) {
    this.expireAt = new Date(this.scheduleDate);
  }
  next();
});
publishLoadSchema.index({ "from.location": "2dsphere" });
publishLoadSchema.index({ "to.location": "2dsphere" });

const PublishLoad = mongoose.model('publishLoad', publishLoadSchema);

module.exports = { PublishLoad };