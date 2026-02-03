const express = require('express');
const router = express.Router();

const {sendOTP, verifyOTP,refreshAccessToken,logout,setMyRole} = require('./auth.controller');
const jwtAuth = require('../../middleware/jwtToken')


router.post('/sendOTP',sendOTP);
router.post('/verifyOTP',verifyOTP);
router.post('/refreshToken', refreshAccessToken);
router.post('/setMyRole/:userId', setMyRole);
router.post('/logout', jwtAuth, logout);

module.exports = router;