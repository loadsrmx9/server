const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const {reportLoad} = require('./report.controller');

router.post("/load", jwtAuth, reportLoad);

module.exports = router;