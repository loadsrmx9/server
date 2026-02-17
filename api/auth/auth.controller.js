const jwt = require('jsonwebtoken');

const { GenerateOTP, ValidateLoadInput } = require('../../utils/utils');
const { UserData } = require('../../modals/userSchema');
const { RequiredFields, StatusCodes, CommonMessages } = require('../../constants/common.constants');
const { client } = require('../../utils/redis');
const AuthConstants = require('../../constants/auth.constants');
const logger = require('../../utils/logger');

// =================== SEND OTP ======================//

const sendOTP = async (req, res) => {
    try {
        let { phone } = req.body;
        const { errors } = await ValidateLoadInput(req.body, RequiredFields.SEND_OTP);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                errors
            });
        }

        phone = AuthConstants.IND_FORMAT(phone);
        const key = `otp:${phone}`;
        const isDev = process.env.NODE_ENV === "development";
        const otp = isDev
            ? process.env.MASTER_TEST_OTP
            : GenerateOTP();

        // store OTP in redis with 60 seconds expiry
        await client.set(key, otp, { EX: AuthConstants.OTP_EXPIRY });

        //pass data to DB
        await UserData.updateOne(
            { phone },
            { $setOnInsert: { phone } },
            { upsert: true }
        );


        return res.status(StatusCodes.OK).json(
            {
                status: CommonMessages.TRUE,
                message: AuthConstants.OTP_SUCCESS(phone)
            });
    } catch (err) {
        logger.error(err, AuthConstants.SEND_OTP_LOG);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            error: CommonMessages.SERVER_ERROR
        });
    }
}

// ========================= VERIFY OTP ========================//

const verifyOTP = async (req, res) => {
    try {
        let { phone } = req.body;
        const { errors } = await ValidateLoadInput(req.body, RequiredFields.VERIFY_OTP, client);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status:CommonMessages.FALSE, 
                errors 
            });
        }

        phone = AuthConstants.IND_FORMAT(phone);
        const findUser = await UserData.findOne({ phone }).lean();

        if (!findUser) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: AuthConstants.USER_NOT_FOUND });
        }

        const otpKey = `otp:${phone}`;
        const refreshKey = `refresh:${findUser._id}`;

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

        // store refresh token & del otp  in redis 
        const redisTasks = [
            client.del(otpKey).catch(e => logger.error(AuthConstants.OTP_DEL_ERROR, e)),
            client.set(refreshKey, refreshToken, { EX: AuthConstants.REFRESH_EXPIRY })
        ];

        await Promise.all(redisTasks);

        return res.status(StatusCodes.OK).json({
            status: CommonMessages.TRUE,
            message: AuthConstants.OTP_VERIFIED,
            data: {
                accessToken, refreshToken,
                role: findUser.role
            }
        })
    } catch (err) {
        logger.error(err, AuthConstants.VERIFY_OTP_LOG);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
            status: CommonMessages.FALSE, 
            error: CommonMessages.SERVER_ERROR 
        });
    }
}

// ============================= REFRESH TOKEN ===========================//

const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.REFRESH_REQUIRED
            });
        }

        // verify refresh token
        let payload;
        try {
            payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY);
        } catch (err) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.INVALID_REFRESH
            });
        }

        const userId = payload.id;
        const refreshKey = `refresh:${userId}`;

        // check token in redis
        let savedToken;
        try {
            savedToken = await client.get(refreshKey);
        } catch (err) {
            logger.error(err, AuthConstants.READ_REFRESH);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.READ_REFRESH
            });
        }

        if (!savedToken || savedToken !== refreshToken) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.REFRESH_EXPIRED
            });
        }

        // generate new access token
        const newAccessToken = jwt.sign(
            { id: userId },
            process.env.JWT_ACCESS_KEY,
            { expiresIn: process.env.ACCESS_TOKEN_EXP || "15m" }
        );

        return res.status(StatusCodes.OK).json({
            status: CommonMessages.TRUE,
            message: AuthConstants.REFRESH_SUCCESS,
            data: { accessToken: newAccessToken }
        });

    } catch (err) {
        logger.error(err, AuthConstants.REFRESH_LOG_API);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            message: CommonMessages.SERVER_ERROR
        });
    }
};

// =================================== SET USER ROLE =============================//

const setMyRole = async (req, res) => {
    try {
        const userId = req.id;
        const { role } = req.body;

        if (!role) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.ROLE_REQUIRED,
            });
        }

        if (!AuthConstants.ALLOWED_ROLES.includes(role)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.INVALID_ROLE,
            });
        }

        const updatedUser = await UserData.findByIdAndUpdate(
            userId,
            { $set: { role } },
            { new: true, projection: { role: 1 } }
        ).lean();

        if (!updatedUser) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.USER_NOT_FOUND,
            });
        }

        return res.status(StatusCodes.OK).json({
            status: CommonMessages.TRUE,
            message: AuthConstants.ROLE_SUCCESS,
            role: updatedUser.role,
        });

    } catch (err) {
        logger.error(err, AuthConstants.ROLE_LOG_API);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            message: CommonMessages.SERVER_ERROR,
        });
    }
};

// ========================== LOGOUT =========================//

const logout = async (req, res) => {
    try {
        const userId = req.id;
        const { token } = req.body;

        if (!token) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: CommonMessages.FALSE,
                message: AuthConstants.TOKEN_REQUIRED
            })
        }

        try {
            await client.del(`refresh:${userId}`);
        } catch (err) {
            logger.error(err, AuthConstants.OTP_DEL_ERROR);
        }

        if (token) {
            await UserData.updateOne(
                { _id: userId },
                { $pull: { fcmTokens: { token: token } } }
            );
        }

        return res.status(StatusCodes.OK).json({
            status: CommonMessages.TRUE,
            message: AuthConstants.LOGOUT_SUCCESS
        });

    } catch (err) {

        logger.error(err, AuthConstants.LOGOUT_LOG_API)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: CommonMessages.FALSE,
            message: CommonMessages.SERVER_ERROR
        });
    }
};



module.exports = { sendOTP, verifyOTP, refreshAccessToken, logout, setMyRole }