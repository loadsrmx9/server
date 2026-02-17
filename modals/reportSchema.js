const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userData",
    required: true
  },

  reportType: {
    type: String,
    required: true
  },

  loadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "publishLoad",
    default: null
  },

  reason: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["Pending", "Reviewed"],
    default: "Pending"
  },

  adminAction: {
    type: String,
    enum: ["none", "Blocked", "Invalid Report"],
    default: "none"
  },

  adminFeedback: String,

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userData"
  }

}, { timestamps: true });

const Report = mongoose.model("report", reportSchema);

module.exports = {Report}
