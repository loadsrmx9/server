const express = require('express');
const app = express();
const env = require('dotenv');
env.config();
const mongoose = require('mongoose');
const http = require('http');
const cors = require('cors');
const { CronJobSchdule } = require('./utils/cron');
const { initSocket } = require('./config/socket');
const { connectRedis } = require('./utils/redis');
const logger = require('./utils/logger');


app.use(require("helmet")());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());
const port = process.env.SERVER_PORT


app.use('/api', require('./api/routes'));

//health check
app.get('/info', (req, res) => {
    res.send('application is up and running');
})

const startServer = async () => {
    try {
        // MongoDB
        await mongoose.connect(process.env.MONGO_DB_KEY);
        logger.info("DB Connected");

        // Redis
        await connectRedis();

        // HTTP server
        const server = http.createServer(app);

        // socket
        initSocket(server);

        server.listen(port, () => {
            CronJobSchdule();
            logger.info(`Server started at ${port}`);
        });

    } catch (error) {
        logger.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();
