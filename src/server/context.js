// src/server/context.js

const {
  makeViewSetPacket,
  makeViewPatchPacket,
} = require("../protocol/packets");

/**
 * Create action context passed to each action handler.
 */
function createContext(opts) {
  const socket = opts.socket;
  const user = opts.user;
  const payload = opts.payload;
  const meta = opts.meta;
  const viewStore = opts.viewStore;
  const send = opts.send;
  const broadcastToOthers = opts.broadcastToOthers;

  function view(viewKey) {
    return {
      set(state) {
        // Update store
        viewStore.set(viewKey, state);

        // Send packet
        const packet = makeViewSetPacket(viewKey, state, {
          requestId: meta && meta.requestId,
        });
        send(packet);
      },

      patch(partial) {
        viewStore.patch(viewKey, partial);
        const state = viewStore.get(viewKey);
        const packet = makeViewPatchPacket(viewKey, partial, {
          requestId: meta && meta.requestId,
        });
        send(packet);
      },
    };
  }

  return {
    socket,
    user,
    payload,
    meta,
    view,
    emit: send,
    broadcastToOthers,
  };
}

module.exports = {
  createContext,
};
