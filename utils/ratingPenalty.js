const { UserData } = require("../modals/userSchema");

const applyCancellationPenalty = async (userId, role) => {
  const user = await UserData.findById(userId);
  if (!user) return;

  const penalty = 0.2;

  if (role === "Transporter") {
    user.ratings.transporter.average = Math.max(
      1,
      user.ratings.transporter.average - penalty
    );
  }

  if (role === "TruckOwner") {
    user.ratings.truckOwner.average = Math.max(
      1,
      user.ratings.truckOwner.average - penalty
    );
  }

  await user.save();
};

module.exports = { applyCancellationPenalty };
