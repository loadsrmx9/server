const admin = require("../config/fireBaseFcm");
const {UserData} = require("../modals/userSchema");

const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const user = await UserData.findById(userId).select("fcmToken");
    if (!user?.fcmToken) return;

    const payload = {
      token: user.fcmToken,
      notification: { title, body },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      },
    };

    await admin.messaging().send(payload);
  } catch (err) {
    console.log("Push notification error:", err.message);
  }
};

module.exports = { sendPushToUser };
