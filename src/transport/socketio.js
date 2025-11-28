// src/transport/socketio.js
// Minimal Socket.IO integration.

function attachToSocketIO(io, spa) {
  io.on("connection", (socket) => {
    spa.registerClient(socket);
  });
}

module.exports = { attachToSocketIO };
