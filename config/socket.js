const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { createAdapter } = require("@socket.io/redis-adapter");
const IORedis = require("ioredis");
const { registerLoadTrackingSocket } = require("../api/booking/IntransitSocket");

let io;

const emitToUser = async (userId, event, payload) => {
  if (!io) return;

  const room = String(userId);
  const sockets = await io.in(room).fetchSockets();

  console.log(`📡 Emit ${event} → ${room} | sockets:`, sockets.map(s => s.id));

  io.to(room).emit(event, payload);
};

const initSocket = (server) => {
  console.log("🔥 initSocket called");

  io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket"], // Fly.io requires this
  });

  // 🔐 JWT middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_KEY);
      socket.userId = String(decoded.id);

      next();
    } catch (err) {
      console.error("❌ Socket auth error:", err.message);
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log("✅ Socket connected:", socket.id);
    console.log("👤 User:", socket.userId);

    const room = socket.userId;

    // 🔥 Join permanent user room
    await socket.join(room);
    registerLoadTrackingSocket(socket,emitToUser);
    // 🔥 Kill old ghost sockets
    const sockets = await io.in(room).fetchSockets();
    sockets.forEach((s) => {
      if (s.id !== socket.id) {
        console.log("🔄 Kicking old socket:", s.id);
        s.disconnect(true);
      }
    });

    console.log(`🏠 Active sockets for ${room}:`, sockets.map(s => s.id));

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", socket.id, reason);
      socket.leave(room);
    });
  });
};



module.exports = { initSocket, emitToUser };
