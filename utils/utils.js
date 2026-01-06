
const { CommonMessages } = require('../constants/constants');

//6-digit otp generation
const GenerateOTP = () => {
    const otp = Math.round(Math.random() * 1000000);
    return String(otp).padStart(6, '0');
}

//data expiration
const ConvertToUTC629 = (dateString) => {
    // Convert user date to Date object
    const dt = new Date(dateString);

    // Set time to 18:29 UTC
    dt.setUTCHours(18, 29, 0, 0);

    return dt;
}

//input validations
const ValidateLoadInput = async (body, requiredFields, client) => {
    let errors = {};
    if (requiredFields) {
        requiredFields.forEach(f => {
            if (!body[f]) {
                errors[f] = CommonMessages.REQUIRED_FIELD(f);
            }
        });
    }


    if (body.alternativeNo && !/^\d{10}$/.test(body.alternativeNo)) {
        errors.alternativeNo = CommonMessages.INVALID_ALT_MOBILE;
    }

    if (body.otp && !/^\d{4,6}$/.test(body.otp)) {
        errors.otp = CommonMessages.OTP_LENGTH;
    }

    if (body.otp && body.phone && client) {
        const key = `otp:${body.phone}`;
        const storedOtp = await client.get(key);

        if (!storedOtp) {
            errors.otp = CommonMessages.OTP_EXPIRED;
        } else if (storedOtp !== body.otp) {
            errors.otp = CommonMessages.OTP_INVALID;
        }
    }

    //lat and long validation

    // if(body.fromCoords.length<2){
    //     errors.fromCoords = CommonMessages.FROM_COORDS_ERROR
    // }
    // if(body.toCoords.length<2){
    //     errors.toCoords = CommonMessages.TO_COORDS_ERROR
    // }

    // Date validation only if scheduleDate exists and has NO "required" error
    if (body.scheduleDate && !errors.scheduleDate) {
        const scheduleUTC = ConvertToUTC629(body.scheduleDate);
        const nowUTC = new Date();

        if (scheduleUTC <= nowUTC) {
            errors.scheduleDate = CommonMessages.INVALID_DATE;
        }
    }

    const expireAt = ConvertToUTC629(body.scheduleDate);

    return {
        errors,
        scheduleUTC: body.scheduleDate ? ConvertToUTC629(body.scheduleDate) : null,
        expireAt
    };
};


const ResponseModify = (load) => {
    const loadObj = typeof load.toObject === "function"
        ? load.toObject()
        : load;

    const responseData = {
        ...loadObj,

        from: {
            address: loadObj.from.address,
            coordinates: loadObj.from.location.coordinates
        },

        to: {
            address: loadObj.to.address,
            coordinates: loadObj.to.location.coordinates
        }
    };
    return responseData
}

const mapLoadListItem = (load) => ({
  loadId: load._id,
  fromAddress: load.from?.address,
  toAddress: load.to?.address,
  amount: load.amount,
  loadType: load.loadType,
  capacity: load.capacity,
  scheduleDate: load.scheduleDate,
  createdAt: load.createdAt
});


module.exports = { GenerateOTP, ValidateLoadInput, ResponseModify,mapLoadListItem };