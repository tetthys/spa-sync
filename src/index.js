// src/index.js

const { createSpaSyncServer } = require("./server/createSpaSyncServer");
const { attachToSocketIO } = require("./transport/socketio");

module.exports = {
  createSpaSyncServer,
  attachToSocketIO,
};
