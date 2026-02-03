const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const upload = require('../../middleware/multer');
const { getProfile, submitKyc ,updateFcmToken} = require('./user.controller')

router.get('/profile', jwtAuth, getProfile);

router.patch('/sendFcm', jwtAuth, updateFcmToken);

router.patch(
    "/updateProfile",
    jwtAuth,
    upload.fields([
        { name: "aadharFront", maxCount: 1 },
        { name: "aadharBack", maxCount: 1 },

        { name: "dlFront", maxCount: 1 },
        { name: "dlBack", maxCount: 1 },

        { name: "rcFront", maxCount: 1 },
        { name: "rcBack", maxCount: 1 },

        { name: "userImage", maxCount: 1 },
    ]),
    submitKyc
);


module.exports = router;