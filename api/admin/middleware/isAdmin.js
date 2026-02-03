const { UserData } = require("../../../modals/userSchema");
const { StatusCodes } = require("../../../constants/constants");

const isAdmin = async (req, res, next) => {
  try {
    const user = await UserData.findById(req.id).lean();

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: false,
        message: "Unauthorized",
      });
    }

    if (user.role !== "admin") {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "Access denied. Admin only",
      });
    }

    next();
  } catch (error) {
    console.log("isAdmin error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Server error",
    });
  }
};

module.exports = isAdmin;
