
const Twilio = require('twilio');
const redis = require('redis');
const jwt = require('jsonwebtoken');

const { GenerateOTP, ValidateLoadInput } = require('../../utils/utils');
const { UserData } = require('../../modals/userSchema');
const { RequiredFields, StatusCodes, CommonMessages } = require('../../constants/constants');
const { refreshToken } = require('firebase-admin/app');

//==================
//redis connection
//==================

const client = redis.createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    }
});

client.on('error', err => console.log('Redis Client Error', err));

(async () => {
    try {
        await client.connect();
        console.log('Redis connected');
    } catch (e) {
        console.error('Failed to connect to Redis', e);
    }
})();

//=====================
//send otp by twilio
//=====================
const twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

const sendOTP = async (req, res) => {
    try {
        const { phone } = req.body;
        const { errors } = await ValidateLoadInput(req.body, RequiredFields.SEND_OTP);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({ errors });
        }
        const key = `otp:${phone}`;
        const isDev = process.env.NODE_ENV === "development";
        const otp = isDev
            ? process.env.MASTER_TEST_OTP
            : GenerateOTP();
        // const otp = GenerateOTP();

        if (!isDev) {
            await twilioClient.messages.create({
                body: `Your verification code is ${otp}`,
                from: process.env.TWILIO_FROM_NUMBER,
                to: phone
            });

        }
        // store OTP in redis with 60 seconds expiry
        await client.set(key, otp, { EX: 60 });

        //pass data to DB
        const existingUser = await UserData.findOne({ phone })
        if (!existingUser) {
            const newData = new UserData({ phone });
            await newData.save()
        }

        return res.status(StatusCodes.OK).json(
            {
                success: CommonMessages.TRUE,
                message: CommonMessages.OTP_SUCCESS(phone)
            });
    } catch (err) {
        console.error(CommonMessages.SEND_OTP_API, err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: CommonMessages.FALSE, error: CommonMessages.OTP_FAIL });
    }
}


const verifyOTP = async (req, res) => {
    try {
        const { phone } = req.body;
        const { errors } = await ValidateLoadInput(req.body, RequiredFields.VERIFY_OTP, client);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({ errors });
        }

        const findUser = await UserData.findOne({ phone });
        // OTP is valid — remove it and respond success
        await client.del(`otp:${phone}`);
        let payLoad = {
            id: findUser._id
        }
        //Access Token
        const accessToken = jwt.sign(payLoad, process.env.JWT_ACCESS_KEY, {
            expiresIn: process.env.ACCESS_TOKEN_EXP,
        });

        //Refresh Token
        const refreshToken = jwt.sign(payLoad, process.env.JWT_REFRESH_KEY, {
            expiresIn: process.env.REFRESH_TOKEN_EXP,
        });

        // store refresh token in redis 
        await client.set(`refresh:${findUser._id}`, refreshToken, { EX: 60 * 60 * 24 * 30 });

        return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE, message: CommonMessages.LOGIN_SUCCESS, data: { accessToken, refreshToken, role: findUser.role } })
    } catch (err) {
        console.error(CommonMessages.VERIFY_OTP_API, err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE, error: CommonMessages.LOGIN_FAILED });
    }
}

const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                message: "Refresh token required"
            });
        }

        jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, async (err, payload) => {
            if (err) {
                return res.status(StatusCodes.UNAUTHORIZED).json({
                    status: CommonMessages.FALSE,
                    message: "Invalid refresh token"
                });
            }

            const userId = payload.id;

            // Check refresh token in redis
            const savedToken = await client.get(`refresh:${userId}`);
            if (!savedToken || savedToken !== refreshToken) {
                return res.status(StatusCodes.UNAUTHORIZED).json({
                    status: CommonMessages.FALSE,
                    message: "Refresh token expired / revoked"
                });
            }

            //  issue new access token
            const newAccessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_KEY, {
                expiresIn: process.env.ACCESS_TOKEN_EXP || "15m",
            });

            return res.status(StatusCodes.OK).json({
                status: CommonMessages.TRUE,
                message: "New access token generated",
                data: { accessToken: newAccessToken }
            });
        });

    } catch (error) {
        console.error("refreshAccessToken error:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            message: "Server error"
        });
    }
};

const setMyRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Role is required",
      });
    }

    const allowedRoles = ["transporter","truckOwner"];
    if (!allowedRoles.includes(role)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Invalid role. Allowed roles are transporter & truckowner",
      });
    }

    const updatedUser = await UserData.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "User role updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.log("setUserRole error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Server error",
    });
  }
};



const logout = async (req, res) => {
    try {
        const userId = req.id;

        await client.del(`refresh:${userId}`);

        return res.status(StatusCodes.OK).json({
            status: CommonMessages.TRUE,
            message: "Logged out successfully"
        });

    } catch (err) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            message: "Server error"
        });
    }
};


module.exports = { sendOTP, verifyOTP, refreshAccessToken, logout,setMyRole }