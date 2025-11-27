// src/protocol/packets.js

/**
 * Create action packet (client → server).
 * This is mainly for reference and tests; real clients will usually
 * construct these packets in their own code.
 */
function makeActionPacket(name, payload, meta) {
  return {
    type: "action",
    name,
    payload: payload || {},
    // meta is a generic metadata bag; requestId is optional
    meta: meta || {},
  };
}

/**
 * Create full view snapshot packet (server → client).
 * The client can interpret this as "replace the entire view state".
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
 * Create partial view patch packet (server → client).
 * The client can interpret this as "merge this partial state into
 * the existing view state".
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
