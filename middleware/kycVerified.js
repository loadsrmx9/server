const { StatusCodes, CommonMessages } = require("../constants/common.constants");
const { UserData } = require("../modals/userSchema");

const transporterOnly = async (req, res, next) => {
  try {
    const user = await UserData.findById(req.id).select(
      "role transporterKycStatus"
    );

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "User not found",
      });
    }

    if (user.role !== "Transporter") {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "Only transporters can post loads",
      });
    }

    if (user.transporterKycStatus !== "Approved") {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: CommonMessages.FALSE,
        message: "KYC approval required to post loads",
      });
    }

    next();
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      message: CommonMessages.SERVER_ERROR,
    });
  }
};


const truckOwnerOnly = async (req, res, next) => {
  try {
    const user = await UserData.findById(req.id).select(
      "role truckOwnerKycStatus"
    );

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "User not found",
      });
    }

    if (user.role !== "TruckOwner") {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: CommonMessages.FALSE,
        message: "Only truck owners can book loads",
      });
    }

    if (user.truckOwnerKycStatus !== "Approved") {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: CommonMessages.FALSE,
        message: "KYC approval required to book loads",
      });
    }

    next();
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: CommonMessages.FALSE,
      message: CommonMessages.SERVER_ERROR,
    });
  }
};


module.exports = {transporterOnly,truckOwnerOnly};
