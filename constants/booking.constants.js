const BookingConstants = {

    //LOG API
    BOOK_LOAD_LOG: "Book load API:",
    APPROVE_LOAD_LOG: "Approve load API:",
    REJECT_LOAD_LOG: "Reject load API:",
    BOOK_REQ_LOG: "Booking request API:",
    CANCEL_LOAD_LOG: "Cancel booking API:",
    UPDATE_STATUS_LOG: "Update booking status API:",
    ACTIVE_STATUS: "Active",
    PENDING_STATUS: "Pending",
    BOOKED_STATUS: "Booked",
    CANCELLED_STATUS: "Cancelled",
    APPROVED_STATUS: "Approved",
    USER_NOT_FOUND: "User not found",

    // book load constants
    LOAD_NOT_FOUND: "Load not found or inactive",
    BOOKING_NOT_FOUND: "Booking not found or already processed",
    OWN_LOAD: "You cannot book your own load",
    BOOKED_LOAD: "Already booked this load",
    BLOCK_DRIVER: ["Approved", "StartedTrip", "ReachedPickup","InTransit",],
    ACTIVE_BOOKING: "You already have an active booking. Complete it before booking another",
    PENDING_BOOK_EXPIRES: 3 * 60 * 60 * 1000,
    BOOK_SUCCESS: "Load booked successfully",

    // approve load constants
    APPROVE_BOOK_EXPIRES: 15 * 60 * 1000,
    CANCELLED_BY_OWNER: "Transporter",
    APPROVED_OTHER_USER: "Load already approved for another user",
    APPROVE_SUCCESS: "Booking approved successfully",

    // cancel load constants
    CANCEL_SUCCESS: "Booking cancelled successfully",
    REJECT_SUCCESS: "Booking rejected successfully",
    ALLOWED_CANCEL: ["Pending", "Approved"],
    BOOKING_CANCELLED: "Booking is already cancelled",
    INVALID_STATUS_FLOW: "Invalid status transition",
    CANCEL_BY_USER: "TruckOwner",

    // booking requests constants
    BOOK_REQ_SUCCESS: "Pending booking requests",

    // booking status constants
    BOOK_NOT_APPROVED: "Booking not approved yet",
    OWNER_ACTION: "Only owner can do this action",
    USER_ACTION: "Only driver/booker can do this action",
    ALLOWED_STATUS: ["StartedTrip", "ReachedPickup", "PickedUp", "Delivered"],
    COORD_REQUIRED: "Current location is required",
    PICKED_UP: "PickedUp",
    DELIVERED: "Delivered",
    IN_TRANSIT: "InTransit",
    REACHED_PICKUP: "ReachedPickup",
    START_TRIP: "StartedTrip",
    COMPLETED: "Completed",
    PICKUP_KM_MSG: "You must be within 1KM of pickup location",
    DELIVERD_KM_MSG: "You must be within 1KM of delivery location",
    BOOKING_STATUS_SUCCESS: "Booking status updated successfully"


}

module.exports = BookingConstants