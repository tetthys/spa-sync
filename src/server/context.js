// src/server/context.js
// Context passed to each action handler. Generates spa.route DSL.

const { makeRoutePacket } = require("../protocol/packets");

/**
 * Context provides two main abilities:
 * 1)   ctx.emitRoute(dsl)
 * 2)   ctx.view("key").show(payload)
 */
function createContext(opts) {
  const { socket, user, payload, meta, sendRoute, viewStore } = opts;

  function view(viewKey) {
    return {
      /**
       * Replace view payload and send spa.route DSL.
       */
      show(nextPayload) {
        const safePayload =
          nextPayload && typeof nextPayload === "object" ? nextPayload : {};

        viewStore.set(viewKey, safePayload);

        sendRoute(
          makeRoutePacket({
            navigation: null,
            view: { key: viewKey, props: {} },
            payload: safePayload,
            flashes: {},
            meta: Object.assign({}, meta, { viewKey }),
          })
        );
      },
    };
  }

  function emitRoute(dsl) {
    sendRoute(makeRoutePacket(dsl));
  }

  return {
    socket,
    user,
    payload,
    meta,

    view,
    emitRoute,
  };
}

module.exports = { createContext };
