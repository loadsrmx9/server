const SocketConstants = {

    // Book load constants
    BOOKING_CREATED: "BOOKING_CREATED",
    BOOKING_MSG: "New Booking Requests",

    // Approve load constants
    BOOKING_APPROVED: "BOOKING_APPROVED",
    BOOK_APPROVED_MSG: "Approved",

    // reject load constants
    BOOKING_REJECTED: "BOOKING_REJECTED",
    BOOK_REJ_MSG: "Cancelled",

    // cancel load constants
    BOOKING_CANCELLED: "BOOKING_CANCELLED",
    BOOK_CANCEL_MSG: "Cancelled",
    BOOKING_ACTIVE:"BOOKING_ACTIVE",
    BOOK_ACTIVE_MSG:"Active",

    // booking status constants
    BOOKING_STATUS: "BOOKING_STATUS",
    TRACKING_START: "TRACKING_START",
    TRACKING_STOP: "TRACKING_STOP",
    BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
    LOAD_PICKED_UP: "LOAD_PICKED_UP",
    LOAD_DELIVERED: "LOAD_DELIVERED",

    // live tracking constants
    DRIVER_LOCATION_UPDATE:"DRIVER_LOCATION_UPDATE",
    DRIVER_LOCATION_LIVE:"DRIVER_LOCATION_LIVE",
    DRIVER_LOC_LOG:"Driver location error:"
}

module.exports = SocketConstants