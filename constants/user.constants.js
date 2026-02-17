const UserConstants = {

    // LOG API
    GET_PROFILE_LOG: "Get profile API:",
    SUBMIT_KYC_LOG: "Submit kyc API:",
    FCM_TOKEN_LOG: "Fcm token API:",
    RATING_LOG: "Rating API:",
    // get profile constants

    PROFILE_SUCCESS: "Profile fetched successfully",
    USER_NOT_FOUND: "User not found",
    BOOKING_NOT_FOUND: "Booking not found",

    // kyc constants
    ROLE_REQUIRED: "Role is required before submitting KYC",
    ALLOWED_ROLES: ["Transporter", "TruckOwner"],
    INVALID_ROLE: "Invalid role for KYC submission",
    AADHAR_IS_SUB: "Aadhar is submitted and cannot be modified",
    DL_IS_SUB: "Driving Licence is submitted and cannot be modified",
    RC_IS_SUB: "RC already submitted and cannot be modified",
    AAD_NO_EXIST: "Aadhar number already exists",
    DL_NO_EXIST: "DL number already exists",
    RC_NO_EXIST: "RC number already exists",
    DUP_DOC_FOUND: "Duplicate document number found",
    TRUCK_OWNER: "TruckOwner",
    NAME_REQ: "Name required",
    USER_IMAGE_REQ: "User image required",
    AAD_NO_REQ: "Aadhar number required",
    AAD_FRONT_REQ: "Aadhar front required",
    AAD_BACK_REQ: "Aadhar back required",
    DL_NO_REQ: "DL number required",
    DL_BACK_REQ: "DL back required",
    DL_FRONT_REQ: "DL front required",
    RC_NO_REQ: "RC number required",
    RC_FRONT_REQ: "RC front required",
    RC_BACK_REQ: "RC back required",
    VALIDATION_FAILED: "Validation failed",
    KYC_SUCCESS: "Your KYC has been submitted successfully. Verification usually takes less than 15 minutes",

    // rating constants
    RATING_ALLOWED: "Rating allowed only after delivery",
    ALREADY_RATED: "Already rated",
    RATING_SUCCESS: "Rating submitted"
}


module.exports = UserConstants;