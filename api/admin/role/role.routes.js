const express = require("express");
const router = express.Router();

const jwtAuth = require("../../../middleware/jwtToken");
const { setUserRole } = require("./role.controller");
router.patch("/setRole/:userId", jwtAuth, setUserRole);

module.exports = router;
