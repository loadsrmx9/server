const { UserData } = require("../../modals/userSchema");
const { Rating } = require("../../modals/ratingSchema");
const { StatusCodes, CommonMessages } = require("../../constants/common.constants");

const { uploadBufferToCloudinary } = require('../../utils/cloudinaryUpload');
const cloudinary = require('../../config/cloudinary');
const logger = require('../../utils/logger');
const UserConstants = require('../../constants/user.constants');
const { encrypt, decrypt, hash } = require("../../utils/crypto");
const { LoadBooking } = require("../../modals/bookingSchema");


const getProfile = async (req, res) => {
  try {
    const user = await UserData.findById(req.id).lean();

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: CommonMessages.FALSE,
        message: UserConstants.USER_NOT_FOUND
      });
    }

    return res.status(StatusCodes.OK).json({
      status: CommonMessages.TRUE,
      message: UserConstants.PROFILE_SUCCESS,
      data: user,
    });
  } catch (err) {
    logger.error(err, UserConstants.GET_PROFILE_LOG);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      message: CommonMessages.SERVER_ERROR,
    });
  }
};

const submitKyc = async (req, res) => {
  // UPLOAD FILES
  const uploaded = {};
  const uploadedPublicIds = [];
  try {
    const { name, aadharNumber, dlNumber, rcNumber } = req.body;
    const files = req.files || {};

    const getFileBuffer = (key) => files?.[key]?.[0]?.buffer || null;

    const buffers = {
      userImage: getFileBuffer("userImage"),
      aadharFront: getFileBuffer("aadharFront"),
      aadharBack: getFileBuffer("aadharBack"),
      dlFront: getFileBuffer("dlFront"),
      dlBack: getFileBuffer("dlBack"),
      rcFront: getFileBuffer("rcFront"),
      rcBack: getFileBuffer("rcBack"),
    };

    const user = await UserData.findById(req.id).lean();
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: UserConstants.USER_NOT_FOUND
      });
    }

    // ROLE REQUIRED
    if (!user.role) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: UserConstants.ROLE_REQUIRED,
      });
    }

    if (!UserConstants.ALLOWED_ROLES.includes(user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: CommonMessages.FALSE,
        message: UserConstants.INVALID_ROLE,
      });
    }

    // DOCUMENT LOCK (pending OR approved)
    const isDocLocked = (doc) =>
      doc &&
      doc.rejectedReason == null &&
      (doc.verified === true || doc.frontImageUrl);

    if (isDocLocked(user.aadhar)) {
      if (
        name ||
        buffers.userImage ||
        aadharNumber ||
        buffers.aadharFront ||
        buffers.aadharBack
      ) {
        return res.status(StatusCodes.FORBIDDEN).json({
          status: CommonMessages.FALSE,
          message: UserConstants.AADHAR_IS_SUB,
        });
      }
    }

    if (isDocLocked(user.drivingLicence)) {
      if (dlNumber || buffers.dlFront || buffers.dlBack) {
        return res.status(StatusCodes.FORBIDDEN).json({
          status: CommonMessages.FALSE,
          message: UserConstants.DL_IS_SUB,
        });
      }
    }

    if (isDocLocked(user.rcBook)) {
      if (rcNumber || buffers.rcFront || buffers.rcBack) {
        return res.status(StatusCodes.FORBIDDEN).json({
          status: CommonMessages.FALSE,
          message: UserConstants.RC_IS_SUB
        });
      }
    }

    // DUPLICATE DOCUMENT CHECK
    const duplicateQuery = [];

    const aadharHash = aadharNumber ? hash(aadharNumber) : null;
    const dlHash = dlNumber ? hash(dlNumber) : null;
    const rcHash = rcNumber ? hash(rcNumber) : null;

    if (aadharHash)
      duplicateQuery.push({ "aadhar.aadharHash": aadharHash });

    if (dlHash)
      duplicateQuery.push({ "drivingLicence.dlHash": dlHash });

    if (rcHash)
      duplicateQuery.push({ "rcBook.rcHash": rcHash });

    if (duplicateQuery.length) {
      const duplicateUser = await UserData.findOne({
        _id: { $ne: req.id },
        $or: duplicateQuery,
      }).lean();

      if (duplicateUser) {
        const errors = {};

        if (duplicateUser?.aadhar?.aadharHash === aadharHash)
          errors.aadharNumber = UserConstants.AAD_NO_EXIST;

        if (duplicateUser?.drivingLicence?.dlHash === dlHash)
          errors.dlNumber = UserConstants.DL_NO_EXIST;

        if (duplicateUser?.rcBook?.rcHash === rcHash)
          errors.rcNumber = UserConstants.RC_NO_EXIST;

        return res.status(StatusCodes.BAD_REQUEST).json({
          status: CommonMessages.FALSE,
          message: UserConstants.DUP_DOC_FOUND,
          errors,
        });
      }
    }

    // ROLE-BASED REQUIREMENTS

    let needAadhar = false;
    let needDL = false;
    let needRC = false;

    if (UserConstants.ALLOWED_ROLES.includes(user.role)) {
      needAadhar =
        !user.aadhar?.aadharNumber || user.aadhar?.rejectedReason;
    }

    if (user.role === "TruckOwner") {
      needDL =
        !user.drivingLicence?.dlNumber ||
        user.drivingLicence?.rejectedReason;

      needRC =
        !user.rcBook?.rcNumber ||
        user.rcBook?.rejectedReason;
    }

    const errors = {};

    if (!user.name && !name) errors.name = UserConstants.NAME_REQ;
    if (!user.userImage && !buffers.userImage)
      errors.userImage = UserConstants.USER_IMAGE_REQ;

    if (needAadhar) {
      if (!aadharNumber) errors.aadharNumber = UserConstants.AAD_NO_REQ;
      if (!buffers.aadharFront) errors.aadharFront = UserConstants.AAD_FRONT_REQ;
      if (!buffers.aadharBack) errors.aadharBack = UserConstants.AAD_BACK_REQ;
    }

    if (needDL) {
      if (!dlNumber) errors.dlNumber = UserConstants.DL_NO_REQ;
      if (!buffers.dlFront) errors.dlFront = UserConstants.DL_FRONT_REQ;
      if (!buffers.dlBack) errors.dlBack = UserConstants.DL_BACK_REQ;
    }

    if (needRC) {
      if (!rcNumber) errors.rcNumber = UserConstants.RC_NO_REQ;
      if (!buffers.rcFront) errors.rcFront = UserConstants.RC_FRONT_REQ;
      if (!buffers.rcBack) errors.rcBack = UserConstants.RC_BACK_REQ;
    }

    if (Object.keys(errors).length) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: CommonMessages.FALSE,
        message: UserConstants.VALIDATION_FAILED,
        errors,
      });
    }

    // success only upload
    if (!user.userImage && buffers.userImage) {
      const file = await uploadBufferToCloudinary(
        buffers.userImage,
        "kyc/user"
      );

      uploaded.userImage = file.url;
      uploadedPublicIds.push(file.public_id);

    }


    if (needAadhar) {
      const front = await uploadBufferToCloudinary(buffers.aadharFront, "kyc/aadhar");
      uploaded.aadharFront = front.url;
      uploadedPublicIds.push(front.public_id);

      const back = await uploadBufferToCloudinary(buffers.aadharBack, "kyc/aadhar");
      uploaded.aadharBack = back.url;
      uploadedPublicIds.push(back.public_id);
    }

    if (needDL) {
      const front = await uploadBufferToCloudinary(buffers.dlFront, "kyc/dl");
      uploaded.dlFront = front.url
      const back = await uploadBufferToCloudinary(buffers.dlBack, "kyc/dl");
      uploaded.dlBack = back.url

    }

    if (needRC) {
      const front = await uploadBufferToCloudinary(buffers.rcFront, "kyc/rc");
      uploaded.rcFront = front.url
      const back = await uploadBufferToCloudinary(buffers.rcBack, "kyc/rc");
      uploaded.rcBack = back.url
    }

    // UPDATE PAYLOAD
    const updatePayload = {};

    if (!user.name && name) updatePayload.name = name;
    if (uploaded.userImage) updatePayload.userImage = uploaded.userImage;

    if (needAadhar) {
      updatePayload.aadhar = {
        aadharNumber: encrypt(aadharNumber),
        aadharHash: hash(aadharNumber),
        frontImageUrl: uploaded.aadharFront,
        backImageUrl: uploaded.aadharBack,
        verified: false,
        rejectedReason: null,
      };
    }

    if (needDL) {
      updatePayload.drivingLicence = {
        dlNumber: encrypt(dlNumber),
        dlHash: hash(dlNumber),
        frontImageUrl: uploaded.dlFront,
        backImageUrl: uploaded.dlBack,
        verified: false,
        rejectedReason: null,
      };
    }

    if (needRC) {
      updatePayload.rcBook = {
        rcNumber: encrypt(rcNumber),
        rcHash: hash(rcNumber),
        frontImageUrl: uploaded.rcFront,
        backImageUrl: uploaded.rcBack,
        verified: false,
        rejectedReason: null,
      };
    }

    updatePayload[
      user.role === "TruckOwner"
        ? "truckOwnerKycStatus"
        : "transporterKycStatus"
    ] = "Pending";

    await UserData.findByIdAndUpdate(req.id, { $set: updatePayload });

    return res.json({
      status: CommonMessages.TRUE,
      message: UserConstants.KYC_SUCCESS,
    });

  } catch (err) {
    logger.error(err, UserConstants.SUBMIT_KYC_LOG);
    if (uploadedPublicIds.length) {
      await Promise.all(
        uploadedPublicIds.map(id =>
          cloudinary.uploader.destroy(id).catch(() => { })
        )
      );
    }
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      message: CommonMessages.SERVER_ERROR,
    });
  }
};




const updateFcmToken = async (req, res) => {
  try {
    const { token, deviceId, platform } = req.body;

    await UserData.updateOne(
      { _id: req.id, "fcmTokens.token": { $ne: token } },
      {
        $push: {
          fcmTokens: { token, deviceId, platform }
        }
      }
    );

    return res.status(StatusCodes.OK).json({ status: CommonMessages.TRUE });
  } catch (err) {
    logger.error(err, UserConstants.FCM_TOKEN_LOG)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: CommonMessages.FALSE });
  }
};

const submitRating = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, review } = req.body;

    const booking = await LoadBooking.findById(bookingId);

    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status:CommonMessages.FALSE, 
        message: UserConstants.BOOKING_NOT_FOUND 
      });
    }

    if (booking.status !== "Completed") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status:CommonMessages.FALSE,
        message: UserConstants.RATING_ALLOWED,
      });
    }

    let toUser;
    let role;

    if (String(booking.ownerId) === req.id) {
      toUser = booking.bookedBy;
      role = "TruckOwner";
    } else if (String(booking.bookedBy) === req.id) {
      toUser = booking.ownerId;
      role = "Transporter";
    } else {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status:CommonMessages.FALSE, 
        message: CommonMessages.UNAUTHORIZED 
      });
    }

    const existing = await Rating.findOne({
      bookingId,
      fromUser: req.id,
    });

    if (existing) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status:CommonMessages.FALSE,
        message: UserConstants.ALREADY_RATED,
      });
    }

    await Rating.create({
      bookingId,
      fromUser: req.id,
      toUser,
      rating,
      review,
      role,
    });

    const user = await UserData.findById(toUser);

    if (role === "Transporter") {
      user.ratings.transporter.count += 1;
      user.ratings.transporter.total += rating;
      user.ratings.transporter.average =
        user.ratings.transporter.total /
        user.ratings.transporter.count;
    } else {
      user.ratings.truckOwner.count += 1;
      user.ratings.truckOwner.total += rating;
      user.ratings.truckOwner.average =
        user.ratings.truckOwner.total /
        user.ratings.truckOwner.count;
    }

    await user.save();

    return res.status(StatusCodes.OK).json({
      status:CommonMessages.TRUE, 
      message: UserConstants.RATING_SUCCESS 
    });

  } catch (err) {
    logger.error(err, UserConstants.RATING_LOG)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      status:CommonMessages.FALSE,
      message: CommonMessages.SERVER_ERROR });
  }
};



module.exports = { getProfile, submitKyc, updateFcmToken, submitRating };
