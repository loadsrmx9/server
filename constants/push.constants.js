const { formatDate } = require("../utils/utils");

const PushConstants = {

  // Book load
  BOOK_TITLE: "New Booking Request",
  BOOK_MSG: (load) =>
    `A new booking request has been received for ${load.from.city} - ${load.to.city} (${formatDate(load.scheduleDateTime)}). Please review and respond.`,

  // Approve booking
  APPROVE_TITLE: "Booking Approved",
  APPROVE_MSG: (booking) =>
    `Your booking for ${booking.loadId.from.city} - ${booking.loadId.to.city} (${formatDate(booking.loadId.scheduleDateTime)}) has been approved.`,

  // Reject booking
  REJECT_TITLE: "Booking Rejected",
  REJECT_MSG: (booking) =>
    `Your booking for ${booking.loadId.from.city} - ${booking.loadId.to.city} (${formatDate(booking.loadId.scheduleDateTime)}) was rejected.`,

  // Cancel booking
  CANCEL_TITLE: "Booking Cancelled",
  CANCEL_OWNER_MSG: (booking) =>
    `The TruckOwner cancelled the booking for ${booking.loadId.from.city} - ${booking.loadId.to.city}.`,

  CANCEL_USER_MSG: (booking) =>
    `The Transporter cancelled the booking for ${booking.loadId.from.city} - ${booking.loadId.to.city}.`,

  // Start trip (NEW)
  START_TRIP_TITLE: "Trip Started",
  START_TRIP_MSG: (routeText) =>
    `The driver has started the trip for ${routeText}. Live tracking is now available.`,

  // Reached pickup (NEW)
  REACHED_PICKUP_TITLE: "Driver Reached Pickup Location",
  REACHED_PICKUP_MSG: (routeText) =>
    `The driver has reached the pickup location for ${routeText}.`,

  // Picked up
  PICK_TITLE: "Load Picked Up",
  PICK_MSG: (routeText) =>
    `The load for ${routeText} has been picked up and is now in transit.`,

  // Delivered
  DEL_TITLE: "Load Delivered",
  DEL_MSG: (routeText) =>
    `The load for ${routeText} has been successfully delivered.`,
};

module.exports = PushConstants;
