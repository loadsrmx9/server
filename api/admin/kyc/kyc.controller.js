const { StatusCodes } = require("../../../constants/constants");
const { UserData } = require("../../../modals/userSchema");

// ✅ helper -> update overall kycVerified + kycStatus
const updateUserKycVerified = async (userId) => {
  const user = await UserData.findById(userId).lean();
  if (!user) return;

  const aadharVerified = user?.aadhar?.verified === true;
  const dlVerified = user?.drivingLicence?.verified === true;
  const rcVerified = user?.rcBook?.verified === true;

  const allVerified = aadharVerified && dlVerified && rcVerified;

  // ✅ overall KYC status
  let kycStatus = "pending";
  if (allVerified) kycStatus = "approved";
  else if (
    user?.aadhar?.rejectedReason ||
    user?.drivingLicence?.rejectedReason ||
    user?.rcBook?.rejectedReason
  ) {
    // optional: if any rejection reason exists
    kycStatus = "rejected";
  }

  await UserData.findByIdAndUpdate(userId, {
    $set: {
      kycStatus,
    },
  });
};

// ✅ Approve KYC Document (aadhar / drivingLicence / rcBook)
const approveKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { docType } = req.body;

    const allowedDocs = ["aadhar", "drivingLicence", "rcBook"];
    if (!allowedDocs.includes(docType)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Invalid docType. Allowed: aadhar, drivingLicence, rcBook",
      });
    }

    const user = await UserData.findById(userId).lean();
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "User not found",
      });
    }

    // ✅ approve only requested doc + clear reject reason
    const updatedUser = await UserData.findByIdAndUpdate(
      userId,
      {
        $set: {
          [`${docType}.verified`]: true,
          [`${docType}.rejectedReason`]: null,
        },
      },
      { new: true }
    ).lean();

    // ✅ update overall user.kycVerified + kycStatus
    await updateUserKycVerified(userId);

    return res.status(StatusCodes.OK).json({
      status: true,
      message: `${docType} approved successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.log("approveKyc error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Server error",
    });
  }
};

// ✅ Reject KYC Document (aadhar / drivingLicence / rcBook)
const rejectKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { docType, reason } = req.body;

    const allowedDocs = ["aadhar", "drivingLicence", "rcBook"];
    if (!allowedDocs.includes(docType)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Invalid docType. Allowed: aadhar, drivingLicence, rcBook",
      });
    }

    if (!reason) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Reject reason is required",
      });
    }

    const user = await UserData.findById(userId).lean();
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "User not found",
      });
    }

    // ✅ reject only that doc
    const updatedUser = await UserData.findByIdAndUpdate(
      userId,
      {
        $set: {
          [`${docType}.verified`]: false,
          [`${docType}.rejectedReason`]: reason,
        },
      },
      { new: true }
    ).lean();

    // ✅ update overall user.kycVerified + kycStatus
    await updateUserKycVerified(userId);

    return res.status(StatusCodes.OK).json({
      status: true,
      message: `${docType} rejected successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.log("rejectKyc error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Server error",
    });
  }
};

module.exports = { approveKyc, rejectKyc };
