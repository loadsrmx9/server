const { UserData } = require("../../modals/userSchema");
const { StatusCodes } = require("../../constants/constants");

const {uploadBufferToCloudinary} = require('../../utils/cloudinaryUpload')

const getProfile = async (req, res) => {
  try {
    const user = await UserData.findById(req.id).lean();

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "User details",
      data: user,
    });
  } catch (error) {
    console.log("getProfile error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Server error",
    });
  }
};

const submitKyc = async (req, res) => {
  try {
    const { name, aadharNumber, dlNumber, rcNumber } = req.body;

    const files = req.files || {};
    const getFileBuffer = (key) => files?.[key]?.[0]?.buffer || null;

    const buffers = {
      aadhar: {
        front: getFileBuffer("aadharFront"),
        back: getFileBuffer("aadharBack"),
      },
      dl: {
        front: getFileBuffer("dlFront"),
        back: getFileBuffer("dlBack"),
      },
      rc: {
        front: getFileBuffer("rcFront"),
        back: getFileBuffer("rcBack"),
      },
      userImage: getFileBuffer("userImage"),
    };

    // ✅ 1) Validate first
    const errors = {};

    if (!name) errors.name = "Name is required";
    if (!buffers.userImage) errors.userImage = "User image is required";

    if (!aadharNumber) errors.aadharNumber = "Aadhar number is required";
    if (!buffers.aadhar.front) errors.aadharFront = "Aadhar front image required";
    if (!buffers.aadhar.back) errors.aadharBack = "Aadhar back image required";

    if (!dlNumber) errors.dlNumber = "DL number is required";
    if (!buffers.dl.front) errors.dlFront = "DL front image required";
    if (!buffers.dl.back) errors.dlBack = "DL back image required";

    if (!rcNumber) errors.rcNumber = "RC number is required";
    if (!buffers.rc.front) errors.rcFront = "RC front image required";
    if (!buffers.rc.back) errors.rcBack = "RC back image required";

    if (Object.keys(errors).length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "All fields are required",
        errors,
      });
    }

    // ✅ 2) Duplicate number check before upload
    const duplicate = await UserData.findOne({
      _id: { $ne: req.id },
      $or: [
        { "aadhar.aadharNumber": aadharNumber },
        { "drivingLicence.dlNumber": dlNumber },
        { "rcBook.rcNumber": rcNumber },
      ],
    }).lean();

    if (duplicate) {
      const dupErrors = {};
      if (duplicate?.aadhar?.aadharNumber === aadharNumber)
        dupErrors.aadharNumber = "Aadhar number already exists";
      if (duplicate?.drivingLicence?.dlNumber === dlNumber)
        dupErrors.dlNumber = "DL number already exists";
      if (duplicate?.rcBook?.rcNumber === rcNumber)
        dupErrors.rcNumber = "RC number already exists";

      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Duplicate document number found",
        errors: dupErrors,
      });
    }

    // ✅ 3) Now upload to cloudinary (ONLY after validation success)
    const [
      userImageUrl,

      aadharFrontUrl,
      aadharBackUrl,

      dlFrontUrl,
      dlBackUrl,

      rcFrontUrl,
      rcBackUrl,
    ] = await Promise.all([
      uploadBufferToCloudinary(buffers.userImage, "kyc/userImage"),

      uploadBufferToCloudinary(buffers.aadhar.front, "kyc/aadhar"),
      uploadBufferToCloudinary(buffers.aadhar.back, "kyc/aadhar"),

      uploadBufferToCloudinary(buffers.dl.front, "kyc/dl"),
      uploadBufferToCloudinary(buffers.dl.back, "kyc/dl"),

      uploadBufferToCloudinary(buffers.rc.front, "kyc/rc"),
      uploadBufferToCloudinary(buffers.rc.back, "kyc/rc"),
    ]);

    // ✅ 4) Save to DB
    const updatedUser = await UserData.findByIdAndUpdate(
      req.id,
      {
        $set: {
          name,
          userImage: userImageUrl,

          kycVerified: false,
          kycStatus: "pending",

          aadhar: {
            aadharNumber,
            frontImageUrl: aadharFrontUrl,
            backImageUrl: aadharBackUrl,
            verified: false,
            rejectedReason: null,
          },

          drivingLicence: {
            dlNumber,
            frontImageUrl: dlFrontUrl,
            backImageUrl: dlBackUrl,
            verified: false,
            rejectedReason: null,
          },

          rcBook: {
            rcNumber,
            frontImageUrl: rcFrontUrl,
            backImageUrl: rcBackUrl,
            verified: false,
            rejectedReason: null,
          },
        },
      },
      { new: true }
    ).lean();

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "KYC submitted successfully. Status pending",
      data: updatedUser,
    });
  } catch (error) {
    console.log("submitKyc error:", error);

    // duplicate key error from unique indexes
    if (error?.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Document number already exists",
        error: error.keyValue,
      });
    }

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};


const updateFcmToken = async (req, res) => {
  try {
    const { token } = req.body;

    await UserData.updateOne(
      { _id: req.id },
      { $set: { fcmToken: token } }
    );

    return res.status(200).json({ status: true, message: "FCM token updated" });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

module.exports = { getProfile, submitKyc,updateFcmToken };
