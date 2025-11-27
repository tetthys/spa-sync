// src/server/context.js

const {
  makeViewSetPacket,
  makeViewPatchPacket,
} = require("../protocol/packets");

/**
 * Create an action context passed to each action handler.
 *
 * This context is intentionally small and focused:
 * - socket, user, payload, meta
 * - view(viewKey).set / view(viewKey).patch
 * - emit (send back to sender)
 * - broadcastToOthers, broadcastToAll, broadcastTo(filterFn)
 */
function createContext(opts) {
  const socket = opts.socket;
  const user = opts.user;
  const payload = opts.payload;
  const meta = opts.meta;
  const viewStore = opts.viewStore;

  const send = opts.send;
  const broadcastToOthers = opts.broadcastToOthers;
  const broadcastToAll = opts.broadcastToAll;
  const broadcastTo = opts.broadcastTo;

  function view(viewKey) {
    return {
      /**
       * Replace the entire view state and send a "set" packet.
       */
      set(state) {
        viewStore.set(viewKey, state);

        const packet = makeViewSetPacket(viewKey, state, {
          // requestId is fully optional; it is simply forwarded from ctx.meta
          requestId: meta && meta.requestId,
        });

        send(packet);
      },

      /**
       * Merge a partial state into the view and send a "patch" packet.
       */
      patch(partial) {
        viewStore.patch(viewKey, partial);

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
    payload: payload || {},
    meta: meta || {},

    view,

    // Send a packet back to the current socket.
    emit: send,

    // Broadcast helpers. These may be no-ops in some transports.
    broadcastToOthers,
    broadcastToAll,
    broadcastTo,
  };
}

module.exports = {
  createContext,
};
