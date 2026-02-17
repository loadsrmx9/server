const express = require("express");
const router = express.Router();

router.use("/auth", require("../api/auth/auth.routes"));
router.use("/users", require("../api/user/user.routes"));
router.use("/loads", require("../api/load/load.routes"));
router.use("/bookings", require("../api/booking/booking.routes"));
router.use("/report", require("../api/report/report.routes"));

module.exports = router;