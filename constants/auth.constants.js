const AuthConstants = {

    REDIS_CONNECTION_ERROR: "Redis Connection Error:",
    REDIS_CONNECTED: "Redis Connected",
    REDIS_FAILES: "Failed to connect to Redis:",
    OTP_DEL_ERROR: "Redis Error OTP delete failed",
    READ_REFRESH:"Redis refresh token read failed",
    OTP_EXPIRY: 120,
    REFRESH_EXPIRY: 60 * 60 * 24 * 30,

    //send otp constants
    TWILIO_LOG: 'Twilio error:',
    SEND_OTP_LOG: 'Send OTP API:',
    TWILIO_ERROR_MSG: 'Twilio external service failure:',
    OTP_SUCCESS: (phone) => `OTP send to ${phone}`,
    IND_FORMAT:(phone)=>`+91${phone}`,

    // verify otp constants
    USER_NOT_FOUND: "User not found",
    OTP_VERIFIED: "Login Success & OTP verified",
    VERIFY_OTP_LOG:"Verify OTP API:",

    // refresh token constants
    REFRESH_REQUIRED: "Refresh token required",
    INVALID_REFRESH: "Invalid refresh token",
    REFRESH_EXPIRED:"Refresh token expired / revoked",
    REFRESH_SUCCESS:"New access token generated",
    REFRESH_LOG_API:"Refresh API:",

    //my role constants
    ROLE_LOG_API:"Set myrole API:",
    ROLE_REQUIRED:"Role is required",
    INVALID_ROLE:"Invalid role please select valid role",
    ROLE_SUCCESS:"Role updated successfully",
    ALLOWED_ROLES:["Transporter","TruckOwner"],

    //logout constants
    LOGOUT_LOG_API:"Logout API:",
    TOKEN_REQUIRED:"Token is required to logout",
    LOGOUT_SUCCESS:"Logged out successfully"
}

module.exports = AuthConstants;
