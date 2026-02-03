const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    fcmToken: { type: String, default: null },
    role: {
      type: String,
      enum: ["Transporter", "TruckOwner", "Admin"],
      default: null
    },

    name: { type: String, default: null },
    userImage: { type: String, default: null },

    // Aadhar
    aadhar: {
      aadharNumber: { type: String, default: null, unique: true, sparse: true },
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },

    // DL
    drivingLicence: {
      dlNumber: { type: String, default: null, unique: true, sparse: true },
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },

    // RC
    rcBook: {
      rcNumber: { type: String, default: null, unique: true, sparse: true },
      verified: { type: Boolean, default: false },
      frontImageUrl: { type: String, default: null },
      backImageUrl: { type: String, default: null },
      rejectedReason: { type: String, default: null },
    },

    kycStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
    },

    totalLoads: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const UserData = mongoose.model("userData", userDataSchema);
module.exports = { UserData };
