// src/transport/socketio.js

/**
 * Attach SpaSync server to Socket.IO instance.
 *
 * @param {import("socket.io").Server} io
 * @param {ReturnType<import("../server/createSpaSyncServer").createSpaSyncServer>} spa
 */
function attachToSocketIO(io, spa) {
  io.on("connection", (socket) => {
    spa.registerClient(socket);
  });
}

module.exports = {
  attachToSocketIO,
};
