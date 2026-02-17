const pino = require("pino");

const isProd = process.env.NODE_ENV === "development";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined, // removes pid + hostname
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProd
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    : undefined
});

module.exports = logger;
