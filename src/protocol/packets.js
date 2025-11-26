// src/protocol/packets.js

/**
 * Create action packet (client → server)
 * This is here just for reference; usually created on client side.
 */
function makeActionPacket(name, payload, meta) {
  return {
    type: "action",
    name,
    payload: payload || {},
    meta: meta || {},
  };
}

/**
 * Create full view snapshot packet (server → client)
 */
function makeViewSetPacket(viewKey, state, meta) {
  return {
    type: "view",
    kind: "set",
    view: viewKey,
    state: state,
    meta: meta || {},
  };
}

/**
 * Create partial view patch packet (server → client)
 */
function makeViewPatchPacket(viewKey, patch, meta) {
  return {
    type: "view",
    kind: "patch",
    view: viewKey,
    patch: patch,
    meta: meta || {},
  };
}

module.exports = {
  makeActionPacket,
  makeViewSetPacket,
  makeViewPatchPacket,
};
