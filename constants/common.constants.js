
const StatusCodes = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    EXTERNAL_SERVICE: 502
}

const RequiredFields = {
    PUBLISH_LOAD: [
        "fromAddress",
        "fromLat",
        "fromLng",
        "fromCity",
        "toAddress",
        "toLat",
        "toLng",
        "toCity",
        "bodyType",
        "truckType",
        "loadType",
        "capacity",
        "amount",
        "scheduleDateTime",
        "receiverName",
        "receiverNo"
    ],
    UPDATE_LOAD: [
        "fromAddress",
        "fromLat",
        "fromLng",
        "fromCity",
        "toAddress",
        "toLat",
        "toLng",
        "toCity",
        "bodyType",
        "truckType",
        "loadType",
        "capacity",
        "amount",
        "receiverName",
        "receiverNo"
    ],
    SEARCH_LOAD: ["fromLat", "fromLng", "toLat", "toLng", "driverLat", "driverLng", "scheduleDate"],
    SEND_OTP: ["phone"],
    VERIFY_OTP: ["phone", "otp"]
}

const CommonMessages = {
    REQUIRED_FIELD: (field) => `${field} is required`,
    INVALID_MOBILE: "Invalid Mobile Number",
    INVALID_DATE: "Schedule date must be greater than the current date",
    OTP_LENGTH: "OTP Must Be 6-Digits",
    OTP_EXPIRED: "OTP expired or not found",
    OTP_INVALID: "Invalid OTP",
    NOT_FOUND: "Data Not Found",
    UNAUTHORIZED: "Unauthorized Request",
    SERVER_ERROR: "Something went wrong please try again later!",
    TRUE: "Success",
    FALSE: "Fail",
    JWT_AUTH_HEAD: "Authorization header is missing",
    JWT_INVALID_AUTH: "Invalid Authorization format",
    JWT_VERIFY: "JWT Verification Failed",
    JWT_SERVER: "JWT Server Error:",
    FROM_RADIUS: 50000,
    TO_RADIUS: 50000,
    EARTH_RADIUS: 6378137

}

module.exports = { RequiredFields, StatusCodes, CommonMessages }