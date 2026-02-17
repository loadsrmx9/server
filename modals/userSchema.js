const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, sparse: true },
    fcmTokens: [
      {
        token: { type: String, required: true },
        deviceId: { type: String },
        platform: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    role: {
      type: String,
      enum: ["Transporter", "TruckOwner"],
      default: null
    },

    name: { type: String, default: null },
    userImage: { type: String, default: null },

    // Aadhar
    aadhar: {
      aadharNumber: { type: String }, 
      aadharHash: { type: String, unique: true, sparse: true }, // hash for duplicate check
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },

    // DL
    drivingLicence: {
      dlNumber: { type: String }, 
      dlHash: { type: String, unique: true, sparse: true },
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },

    // RC
    rcBook: {
      rcNumber: { type: String },
      rcHash: { type: String, unique: true, sparse: true },
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },


    truckOwnerKycStatus: {
      type: String,
      enum: ["not_submitted", "Pending", "Approved", "Rejected"],
      default: "not_submitted",
    },
    transporterKycStatus: {
      type: String,
      enum: ["not_submitted", "Pending", "Approved", "Rejected"],
      default: "not_submitted",
    },

    totalLoads: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },

    reportCount: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String },

    ratings: {
      transporter: {
        average: { type: Number, default: 5 },
        count: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      },
      truckOwner: {
        average: { type: Number, default: 5 },
        count: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      }
    },
  },
  { timestamps: true }
);

const UserData = mongoose.model("userData", userDataSchema);
module.exports = { UserData };
