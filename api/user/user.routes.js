const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const upload = require('../../middleware/multer');
const {getProfile,updateProfile} = require('./user.controller')

router.get('/profile',jwtAuth,getProfile);
router.patch('/updateProfile',jwtAuth,upload.single("profileImage"),updateProfile);


module.exports = router;