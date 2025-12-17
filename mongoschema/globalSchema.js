const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
    email: { type: String, required: false },
    name: { type: String, required: false },
    phone: { type: String, required: true },
    profileImage: { data: Buffer, contentType: String }
})

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
    expireAt: { type: Date },
    status: { type: String, default: "active" }, // active | completed | deleted
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId }]
  },
  { timestamps: true }
);
publishLoadSchema.index({ "from.location": "2dsphere" });
publishLoadSchema.index({ "to.location": "2dsphere" });


const UserData = mongoose.model('userData', userDataSchema);
const PublishLoad = mongoose.model('publishLoad', publishLoadSchema);

module.exports = { UserData, PublishLoad };