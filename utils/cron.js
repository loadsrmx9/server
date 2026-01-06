const cron = require("node-cron");
const { PublishLoad } = require("../modals/loadSchema");
const { UserData } = require("../modals/userSchema");

const CronJobSchdule = () => {
    console.log("ExpireLoads Cron Job Started Successfully.");

    // Runs every 1 minute
    cron.schedule("*/1 * * * *", async () => {
        try {
            const now = new Date();

            // Find expired active loads FIRST
            const expiredLoads = await PublishLoad.find({
                expireAt: { $lte: now },
                status: "active",
            }).select("_id userId");

            // If nothing to process → exit fast
            if (!expiredLoads.length) return;

            // Group completed count per user
            const completedByUser = {};

            for (const load of expiredLoads) {
                const userId = load.userId.toString();
                completedByUser[userId] =
                    (completedByUser[userId] || 0) + 1;
            }

            // Update loads to completed (bulk)
            await PublishLoad.updateMany(
                { _id: { $in: expiredLoads.map(l => l._id) } },
                { $set: { status: "completed" } }
            );

            // Update user stats correctly (bulkWrite)
            const bulkUserUpdates = Object.entries(completedByUser).map(
                ([userId, count]) => ({
                    updateOne: {
                        filter: { _id: userId },
                        update: { $inc: { "completed": count } }
                    }
                })
            );

            if (bulkUserUpdates.length > 0) {
                await UserData.bulkWrite(bulkUserUpdates);
            }

            console.log(
                `Expired loads processed → ${expiredLoads.length} loads completed.`
            );

        } catch (error) {
            console.error("ERROR in expireLoads cron:", error);
        }
    });
};

module.exports = { CronJobSchdule };
