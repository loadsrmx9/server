const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const {bookLoad,approveLoad,rejectLoad,bookingRequests} = require('./booking.controller')


router.post('/bookLoad/:loadId',jwtAuth,bookLoad);
router.patch('/approveBooking/:bookingId',jwtAuth,approveLoad);
router.patch('/cancelBooking/:bookingId',jwtAuth,rejectLoad);
router.get('/bookingRequests/:loadId',jwtAuth,bookingRequests);


module.exports = router;