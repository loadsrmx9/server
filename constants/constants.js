
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
    PUBLISH_LOAD: ["from", "to", "loadType", "amount", "phoneNo", "scheduleDate"],
    SEARCH_LOAD: ["from", "to", "scheduleDate"],
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
    OTP_SUCCESS:(LastFourDigitPhone)=>`verification code sent to mobile number ending with ${LastFourDigitPhone}`,
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
    JWT_AUTH_HEAD:"Authorization header is missing",
    JWT_INVALID_AUTH:"Invalid Authorization format",
    JWT_VERIFY:"JWT Verification Failed",
    JWT_SERVER:"JWT Server Error:",
    PROFILE_UPDATED:"Profile Updated Successfully"

}

const LoadMessages = {
    CREATED: "Load Posted Successfully",
    UPDATED: "Load Updated Successfully",
    DELETED: "Load Deleted Successfully",
    CANCELLED: "Load Cancelled Successfully",
    NOT_FOUND: "Load Data Not Found or Unauthorized",
    USER_LOAD_DETAILS:"User Load Details",
    LOADS_FETCH:"Loads Fetched Successfully",
    LOAD_DETAILS:"Load details fetched successfully" 
}





module.exports = { RequiredFields, StatusCodes, CommonMessages, LoadMessages }