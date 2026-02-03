const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const { bookLoad, approveLoad, rejectLoad, bookingRequests, cancelBooking, updateBookingStatus } = require('./booking.controller')


router.post('/bookLoad/:loadId', jwtAuth, bookLoad);
router.patch('/approveBooking/:bookingId', jwtAuth, approveLoad);
router.patch('/rejectBooking/:bookingId', jwtAuth, rejectLoad);
router.get('/bookingRequests/:loadId', jwtAuth, bookingRequests);
router.patch('/cancelBooking/:bookingId', jwtAuth, cancelBooking);
router.patch("/booking/:bookingId",
    jwtAuth, updateBookingStatus);


module.exports = router;