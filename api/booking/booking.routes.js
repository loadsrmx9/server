const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const { truckOwnerOnly, transporterOnly } = require('../../middleware/kycVerified');
const { bookLoad, approveLoad, rejectLoad, bookingRequests, cancelBooking, updateBookingStatus } = require('./booking.controller')


router.post('/bookLoad/:loadId', jwtAuth, truckOwnerOnly, bookLoad);
router.patch('/approveBooking/:bookingId', jwtAuth, transporterOnly, approveLoad);
router.patch('/rejectBooking/:bookingId', jwtAuth, transporterOnly, rejectLoad);
router.get('/bookingRequests/:loadId', jwtAuth, transporterOnly, bookingRequests);
router.patch('/cancelBooking/:bookingId', jwtAuth, cancelBooking);
router.patch("/updateBookingStatus/:bookingId", jwtAuth, truckOwnerOnly, updateBookingStatus);


module.exports = router;