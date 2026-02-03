const { UserData } = require("../../../modals/userSchema");
const { StatusCodes } = require("../../../constants/constants");

const setUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Role is required",
      });
    }

    const allowedRoles = ["admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Invalid role. Allowed roles: user, driver, admin",
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

module.exports = { setUserRole };
