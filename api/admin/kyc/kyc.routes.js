const express = require("express");
const router = express.Router();

const jwtAuth = require("../../../middleware/jwtToken");
const isAdmin = require("./../middleware/isAdmin");

const { approveKyc, rejectKyc } = require("./kyc.controller");

// ✅ Admin approves KYC
router.patch("/approve/:userId", jwtAuth, isAdmin, approveKyc);

// ✅ Admin rejects KYC
router.patch("/reject/:userId", jwtAuth, isAdmin, rejectKyc);

module.exports = router;
