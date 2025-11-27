// src/server/createSpaSyncServer.js

const { createActionRegistry } = require("./actionRegistry");
const { createViewStore } = require("./viewStore");
const { createContext } = require("./context");

/**
 * Main server factory.
 *
 * Minimal usage from the package user's perspective:
 *
 *   const spa = createSpaSyncServer({
 *     actions: {
 *       "counter.increment": async (ctx) => {
 *         ctx.view("counter").patch({ value: ctx.payload.value });
 *       },
 *     },
 *   });
 *
 *   io.on("connection", (socket) => {
 *     spa.registerClient(socket);
 *   });
 *
 * All other options are optional:
 * - onAuthorize?: async (socket) => user | null
 * - onError?: (err, ctx?) => void
 */
function createSpaSyncServer(options) {
  const opts = options || {};

  const actions = createActionRegistry(opts.actions || {});
  const viewStore = createViewStore();

  const onAuthorize =
    typeof opts.onAuthorize === "function" ? opts.onAuthorize : () => null;

  const onError =
    typeof opts.onError === "function"
      ? opts.onError
      : function () {
          // Default: do nothing. Users can override this to log errors.
        };

  // clientId -> { socket, user }
  const clients = new Map();

  /**
   * Called when a socket connects.
   * This method is the only thing the user has to call on connection.
   */
  async function registerClient(socket) {
    try {
      const user = await onAuthorize(socket);
      clients.set(socket.id, { socket, user });

      socket.on("message", (packet) => {
        handlePacket(socket, packet).catch((err) => {
          onError(err);
        });
      });

      socket.on("disconnect", () => {
        clients.delete(socket.id);
      });
    } catch (err) {
      onError(err);
      socket.disconnect(true);
    }
  }

  /**
   * Handle incoming packets from a given socket.
   * Currently only "action" packets are supported.
   */
  async function handlePacket(socket, packet) {
    if (!packet || typeof packet !== "object") return;

    if (packet.type === "action") {
      const { name, payload, meta } = packet;
      const fn = actions.get(name);

      if (!fn) {
        socket.emit("message", {
          type: "error",
          name: "UnknownAction",
          message: "Unknown action: " + name,
          meta: {
            action: name,
            // requestId is optional; forward if present, else undefined
            requestId: meta && meta.requestId,
          },
        });
        return;
      }

      const client = clients.get(socket.id) || { socket, user: null };

      // Send back only to the current socket
      const send = (outPacket) => {
        socket.emit("message", outPacket);
      };

      // Broadcast to all other clients
      const broadcastToOthers = (outPacket) => {
        clients.forEach((c, id) => {
          if (id !== socket.id) {
            c.socket.emit("message", outPacket);
          }
        });
      };

      // Broadcast to everyone (including the sender)
      const broadcastToAll = (outPacket) => {
        clients.forEach((c) => {
          c.socket.emit("message", outPacket);
        });
      };

      /**
       * Broadcast to clients that match the given filter function.
       *
       * filterFn receives an object:
       *   { id, socket, user }
       */
      const broadcastTo = (filterFn, outPacket) => {
        if (typeof filterFn !== "function") return;

        clients.forEach((c, id) => {
          const shouldSend = filterFn({
            id,
            socket: c.socket,
            user: c.user,
          });

          if (shouldSend) {
            c.socket.emit("message", outPacket);
          }
        });
      };

      const ctx = createContext({
        socket,
        user: client.user,
        payload: payload || {},
        meta: meta || {},
        viewStore,
        send,
        broadcastToOthers,
        broadcastToAll,
        broadcastTo,
      });

      try {
        await fn(ctx);
      } catch (err) {
        onError(err, ctx);
        socket.emit("message", {
          type: "error",
          name: err && err.name ? err.name : "Error",
          message: err && err.message ? err.message : "Unknown error",
          meta: {
            action: name,
            requestId: meta && meta.requestId,
          },
        });
      }
    }
  }

  return {
    registerClient,
    handlePacket,
    viewStore,
  };
}

module.exports = {
  createSpaSyncServer,
};
