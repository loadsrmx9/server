const cron = require("node-cron");
const { PublishLoad } = require("../modals/loadSchema");
const { LoadBooking } = require("../modals/bookingSchema");
const { sendPushToUser } = require("./sendFcm");
const logger = require("./logger");

const CronJobSchdule = () => {
  cron.schedule("*/1 * * * *", async () => {
    try {
      const now = new Date();

      /*
        PENDING BOOKING REMINDER (30 MIN BEFORE EXPIRY)
      */
      const pendingReminderTime = new Date(now.getTime() + 2 * 60 * 1000);

      const pendingReminders = await LoadBooking.find({
        status: "Pending",
        pendingExpiresAt: { $lte: pendingReminderTime, $gt: now },
        pendingReminderSent: false
      }).populate("loadId");

      for (const booking of pendingReminders) {
        sendPushToUser(
          booking.ownerId,
          "Booking expiring soon",
          "You have booking requests waiting for approval.",
          {
            bookingId: booking._id.toString(),
            loadId: booking.loadId._id.toString(),
            type: "PENDING_EXPIRY_REMINDER"
          }
        ).catch(logger.error);

        booking.pendingReminderSent = true;
        await booking.save();
      }

      /*
        EXPIRE LOADS
      */
      await PublishLoad.updateMany(
        { scheduleDateTime: { $lte: now }, status: "Active" },
        { $set: { status: "Expired" } }
      );

      /*
        EXPIRE PENDING BOOKINGS
      */
      await LoadBooking.updateMany(
        {
          status: "Pending",
          pendingExpiresAt: { $lte: now }
        },
        { $set: { status: "Expired" } }
      );


    } catch (err) {
      logger.error(`ERROR in cron reminders: ${err.message}`);
    }
  });
};

module.exports = { CronJobSchdule };
