const redis = require("redis");
const logger = require("./logger");
const AuthConstants = require('../constants/auth.constants')

const client = redis.createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  }
});

client.on("error", (err) => {
  logger.error(AuthConstants.REDIS_CONNECTION_ERROR,err);
});

client.on("connect", () => {
  logger.info(AuthConstants.REDIS_CONNECTED);
});

const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
};

module.exports = {
  client,
  connectRedis
};
