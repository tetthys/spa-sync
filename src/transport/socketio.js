// src/transport/socketio.js

/**
 * Attach a SpaSync server instance to a Socket.IO server.
 *
 * Minimal usage:
 *
 *   const io = new Server(httpServer);
 *   const spa = createSpaSyncServer({ actions });
 *   attachToSocketIO(io, spa);
 */
function attachToSocketIO(io, spa) {
  io.on("connection", (socket) => {
    spa.registerClient(socket);
  });
}

module.exports = {
  attachToSocketIO,
};
