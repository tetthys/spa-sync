// index.js

// Core server factory
const { createSpaSyncServer } = require("./src/server/createSpaSyncServer");

// Socket.IO transport helper
const { attachToSocketIO } = require("./src/transport/socketio");

// Packet helpers (mainly for clients and tests)
const {
  makeActionPacket,
  makeViewSetPacket,
  makeViewPatchPacket,
} = require("./src/protocol/packets");

// Optional: standalone viewStore for advanced/debug use
const { createViewStore } = require("./src/server/viewStore");

/**
 * Public API of the package.
 *
 * Typical usage:
 *
 *   const { createSpaSyncServer, attachToSocketIO } = require("@tetthys/spa-sync");
 *
 *   const spa = createSpaSyncServer({
 *     actions: {
 *       "counter.increment": async (ctx) => {
 *         const current = ctx.payload.current || 0;
 *         ctx.view("counter").set({ value: current + 1 });
 *       },
 *     },
 *   });
 *
 *   attachToSocketIO(io, spa);
 */
module.exports = {
  // Core
  createSpaSyncServer,

  // Transport
  attachToSocketIO,

  // Packet helpers
  makeActionPacket,
  makeViewSetPacket,
  makeViewPatchPacket,

  // Advanced / debugging
  createViewStore,
};
