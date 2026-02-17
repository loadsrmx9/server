const admin = require("../config/fireBaseFcm");
const {UserData} = require("../modals/userSchema");

const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const user = await UserData.findById(userId).select("fcmTokens");

    if (!user?.fcmTokens?.length) return;

    const tokens = user.fcmTokens.map(t => t.token);

    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      )
    };

    await admin.messaging().sendEachForMulticast(message);

  } catch (err) {
    console.log("Push error:", err.message);
  }
};

module.exports = { sendPushToUser };
