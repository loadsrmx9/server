
const CronJobSchdule = () => {
    console.log("ExpireLoads Cron Job Started Successfully.");
    cron.schedule("*/1 * * * *", async () => {
        try {
            const now = new Date();

            const result = await PublishLoad.updateMany(
                { expireAt: { $lte: now }, status: "active" },
                { $set: { status: "completed" } }
            );

            if (result.modifiedCount > 0) {
                console.log(`Expired loads updated → ${result.modifiedCount} loads marked as completed.`);
            }

        } catch (error) {
            console.log(`ERROR in expireLoads cron: ${error.message}`);
        }
    });
}

module.exports = { CronJobSchdule }