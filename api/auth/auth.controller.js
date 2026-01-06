
const Twilio = require('twilio');
const redis = require('redis');
const jwt = require('jsonwebtoken');

const { GenerateOTP, ValidateLoadInput } = require('../../utils/utils');
const { UserData } = require('../../modals/userSchema');
const {RequiredFields, StatusCodes, CommonMessages} = require('../../constants/constants');

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
        const { errors } = await ValidateLoadInput(req.body,RequiredFields.SEND_OTP);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({ errors });
        }
        const key = `otp:${phone}`;
        const otp = GenerateOTP();
        const existingUser = await UserData.findOne({ phone })

        await twilioClient.messages.create({
            body: `Your verification code is ${otp}`,
            from: process.env.TWILIO_FROM_NUMBER,
            to: phone
        });

        // store OTP in redis with 60 seconds expiry
        await client.set(key, otp, { EX: 60 });

        //pass data to DB
        if (!existingUser) {
            const newData = new UserData({ phone });
            await newData.save()
        }

        return res.status(StatusCodes.OK).json({ success: CommonMessages.TRUE, message:CommonMessages.OTP_SUCCESS(phone)  });
    } catch (err) {
        console.error(CommonMessages.SEND_OTP_API, err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success: CommonMessages.FALSE, error:CommonMessages.OTP_FAIL });
    }
}


const verifyOTP = async (req, res) => {
    try {
        const { phone } = req.body;
        const { errors } = await ValidateLoadInput(req.body,RequiredFields.VERIFY_OTP, client);

        if (Object.keys(errors).length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({ errors });
        }
        
        const findUser = await UserData.findOne({ phone });
        // OTP is valid — remove it and respond success
        await client.del(`otp:${phone}`);
        let payLoad = {
            id: findUser._id
        }
        const accessToken = jwt.sign(payLoad, process.env.JWT_KEY, { expiresIn: '29d' })
        return res.status(StatusCodes.OK).json({status:CommonMessages.TRUE,message: CommonMessages.LOGIN_SUCCESS ,data:{accessToken,name:findUser.name,email:findUser.email}})
    } catch (err) {
        console.error(CommonMessages.VERIFY_OTP_API, err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({status:CommonMessages.FALSE, error:CommonMessages.LOGIN_FAILED });
    }
}


module.exports = {sendOTP,verifyOTP}