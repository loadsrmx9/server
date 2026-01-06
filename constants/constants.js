
const StatusCodes = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500
}

const RequiredFields = {
    PUBLISH_LOAD: ["fromAddress","fromLat" ,"fromLng", "toAddress","toLat" ,"toLng" ,"loadType","truckType","capacity", "amount", "scheduleDate"],
    SEARCH_LOAD: ["fromCoords", "toCoords", "scheduleDate"],
    SEND_OTP: ["phone"],
    VERIFY_OTP: ["phone", "otp"]
}

const CommonMessages = {
    REQUIRED_FIELD: (field) => `${field} is required`,
    INVALID_MOBILE: "Invalid Mobile Number",
    INVALID_ALT_MOBILE: "Invalid Alternative Mobile Number",
    INVALID_DATE: "Schedule date must be greater than the current date",
    OTP_LENGTH:"OTP Must Be 6-Digits",
    OTP_EXPIRED:"OTP expired or not found",
    OTP_INVALID:"Invalid OTP",
    OTP_SUCCESS:(phone)=>`OTP sent to ${phone}`,
    OTP_FAIL:'Failed to send OTP',
    LOGIN_SUCCESS:'Login Success & OTP verified',
    LOGIN_FAILED:'Failed to verify OTP',
    NOT_FOUND: "Data Not Found",
    UNAUTHORIZED: "Unauthorized Request",
    SERVER_ERROR: "Internal Server Error",
    USER_DETAILS:"User Details Fetched Successfully",
    TRUE:true,
    FALSE:false,
    SEARCH_LOAD_API:"Search Load API:",
    PUBLISH_LOAD_API:"Publish Load API:",
    LOAD_DETAILS_API:"Load Details API:",
    PROFILE_API:"Profile API:",
    USER_LOAD_API:"User Load API:",
    DELETE_LOAD_API:"Delete Load API:",
    CANCEL_LOAD_API:"Cancel Load API:",
    UPDATE_LOAD_API:"Update Load API:",
    SEND_OTP_API:"Send OTP API:",
    VERIFY_OTP_API:"Verify OTP API:",
    BOOK_LOAD_API:"Book Load API:",
    APPROVE_LOAD_API:"Approve Load API:",
    CANCEL_BOOKING_API:"Cancel Booking API:",
    BOOKING_REQUESTS_API:"Booking Requests API:",
    JWT_AUTH_HEAD:"Authorization header is missing",
    JWT_INVALID_AUTH:"Invalid Authorization format",
    JWT_VERIFY:"JWT Verification Failed",
    JWT_SERVER:"JWT Server Error:",
    PROFILE_UPDATED:"Profile Updated Successfully",
    FROM_COORDS_ERROR:"Fromcoords length must be equal to 2",
    TO_COORDS_ERROR:"Tocoords length must be equal to 2",
    FROM_RADIUS:50000,
    TO_RADIUS:50000,
    EARTH_RADIUS:6378137 

}

const LoadMessages = {
    CREATED: "Load Posted Successfully",
    UPDATED: "Load Updated Successfully",
    DELETED: "Load Deleted Successfully",
    CANCELLED: "Load Cancelled Successfully",
    NOT_FOUND: "Load Data Not Found or Unauthorized",
    USER_LOAD_DETAILS:"User Load Details",
    LOADS_FETCH:"Loads Fetched Successfully",
    LOAD_DETAILS:"Load details fetched successfully",
    BOOK_LOAD_NOT_FOUND:"Load not found or inactive",
    BOOK_OWN_LOAD:"You cannot book your own load",
    ALREADY_BOOKED_LOAD:"Already booked this load",
    BOOK_LOAD_SUCCESS:"Load booked successfully",
    BOOKING_NOT_FOUND:"Booking not found or already processed",
    BOOKING_APPROVED_OTHER_USER:"Load already approved for another user",
    PENDING_REQUESTS:"Pending booking requests",


}

const LoadSocketMessages = {
    BOOKING_CREATED:"BOOKING_CREATED",
    BOOKING_REQUESTS:"New booking request received",
    BOOKING_APPROVED:"BOOKING_APPROVED",
    BOOKING_APPROVED_SUCCESS:"Your booking has been approved",
    BOOKING_REJECTED:"BOOKING_REJECTED",
    BOOKING_REJECTED_MESSAGE:"Booking rejected (another user approved)",
    BOOKING_SUCCESS:"Booking approved successfully",
    BOOKING_CANCELLED:"BOOKING_CANCELLED",
    BOOKING_CANCELLED_MESSAGE:"Booking cancelled successfully"
    

}





module.exports = { RequiredFields, StatusCodes, CommonMessages, LoadMessages,LoadSocketMessages }