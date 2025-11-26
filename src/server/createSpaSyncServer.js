// src/server/createSpaSyncServer.js

const { createActionRegistry } = require("./actionRegistry");
const { createViewStore } = require("./viewStore");
const { createContext } = require("./context");
const { makeActionPacket } = require("../protocol/packets");

/**
 * options.actions: { [actionName]: async function(ctx) {} }
 * options.onAuthorize: async function(socket) => user | null
 * options.onError: function(err, ctx)
 */
function createSpaSyncServer(options) {
  const actions = createActionRegistry(options.actions || {});
  const viewStore = createViewStore();
  const onAuthorize = options.onAuthorize || (() => null);
  const onError = options.onError || function () {};

  // clientId -> { socket, user }
  const clients = new Map();

  /**
   * Called when a socket connects.
   */
  async function registerClient(socket) {
    try {
      // Resolve user (optional)
      const user = await onAuthorize(socket);
      clients.set(socket.id, { socket, user });

      // Register message listener
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
   * Handle incoming packet from client.
   */
  async function handlePacket(socket, packet) {
    // Basic validation
    if (!packet || typeof packet !== "object") return;
    if (packet.type === "action") {
      const { name, payload, meta } = packet;
      const fn = actions.get(name);
      if (!fn) {
        // Unknown action → send error
        socket.emit("message", {
          type: "error",
          name: "UnknownAction",
          message: "Unknown action: " + name,
          meta: { action: name, requestId: meta && meta.requestId },
        });
        return;
      }

      const client = clients.get(socket.id) || { socket, user: null };

      const ctx = createContext({
        socket,
        user: client.user,
        payload: payload || {},
        meta: meta || {},
        viewStore,
        send: (packet) => socket.emit("message", packet),
        broadcastToOthers: (packet) => {
          clients.forEach((c, id) => {
            if (id !== socket.id) {
              c.socket.emit("message", packet);
            }
          });
        },
      });

      try {
        await fn(ctx);
      } catch (err) {
        onError(err, ctx);
        socket.emit("message", {
          type: "error",
          name: err.name || "Error",
          message: err.message || "Unknown error",
          meta: { action: name, requestId: meta && meta.requestId },
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
