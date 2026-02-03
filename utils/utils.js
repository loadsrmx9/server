
const { CommonMessages } = require('../constants/constants');

//6-digit otp generation
const GenerateOTP = () => {
    const otp = Math.round(Math.random() * 1000000);
    return String(otp).padStart(6, '0');
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


    if (body.receiverNo && !/^\d{10}$/.test(body.receiverNo)) {
        errors.receiverNo = CommonMessages.INVALID_MOBILE;
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


    // scheduleDateTime validation (date + time required)
    if (body.scheduleDateTime && !errors.scheduleDateTime) {
        // must be string
        if (typeof body.scheduleDateTime !== "string") {
            errors.scheduleDateTime = "Invalid schedule date/time format";
        } else {
            // time must be present (ISO should contain "T")
            if (!body.scheduleDateTime.includes("T")) {
                errors.scheduleDateTime = "Schedule time is required";
            } else {
                const scheduleUTC = new Date(body.scheduleDateTime);

                // invalid date string
                if (isNaN(scheduleUTC.getTime())) {
                    errors.scheduleDateTime = "Invalid schedule date/time";
                } else {
                    const nowUTC = new Date();

                    // must be future
                    if (scheduleUTC <= nowUTC) {
                        errors.scheduleDateTime = CommonMessages.INVALID_DATE; // or custom msg
                    } else {
                        // must be within 30 days
                        const maxUTC = new Date(nowUTC);
                        maxUTC.setDate(maxUTC.getDate() + 30);

                        if (scheduleUTC > maxUTC) {
                            errors.scheduleDateTime =
                                "Schedule date/time must be within 30 days from today";
                        }
                    }
                }
            }
        }
    }


    return {
        errors,
        scheduleUTC: body.scheduleDateTime ? new Date(body.scheduleDateTime) : null,
    };
};


const ResponseModify = (load) => {
    const loadObj = typeof load.toObject === "function"
        ? load.toObject()
        : load;

    const { viewedBy, ...cleanLoad } = loadObj;
    const responseData = {
        ...cleanLoad,

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
    createdAt: load.createdAt,
    viewCount: load.viewedBy.length
});

const mapSearchLoadItem = (load) => ({
    loadId: load._id,

    fromAddress: load.from?.address,
    toAddress: load.to?.address,

    amount: load.amount,
    loadType: load.loadType,
    capacity: load.capacity,
    createdAt: load.createdAt,

    distanceText: load.distanceText,
    durationText: load.durationText,
});


//Indian price formatter

const formatINR = (amount) => {
    const formatedAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);

    return formatedAmount;
}

// format date 03 Jan 2026

const formatDate = (scheduleDate) => {
    const formattedDate = scheduleDate
        ? new Date(scheduleDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "Not scheduled";
    return formattedDate
}


module.exports = { GenerateOTP, ValidateLoadInput, ResponseModify, mapLoadListItem, mapSearchLoadItem, formatINR, formatDate };