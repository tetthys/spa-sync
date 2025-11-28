// index.js
// Public entry for the spa-sync backend package.

const { createSpaSyncServer } = require("./server/createSpaSyncServer");
const { attachToSocketIO } = require("./transport/socketio");
const { makeRoutePacket, makeActionPacket } = require("./protocol/packets");
const { createViewStore } = require("./server/viewStore");

module.exports = {
  // Core server
  createSpaSyncServer,

  // Socket.IO transport helper
  attachToSocketIO,

  // Protocol helpers (useful for tests and custom clients)
  makeRoutePacket,
  makeActionPacket,

  // View payload store (can be used standalone in some apps/tests)
  createViewStore,
};
