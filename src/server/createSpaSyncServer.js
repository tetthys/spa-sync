// src/server/createSpaSyncServer.js
// Main server for handling action packets and emitting spa.route DSL.

const { createActionRegistry } = require("./actionRegistry");
const { createViewStore } = require("./viewStore");
const { createContext } = require("./context");

/**
 * Server lifecycle:
 * 1. Client sends { type: "action", name, payload, meta }
 * 2. Server resolves action handler
 * 3. ctx.view("key").show(...) or ctx.emitRoute(dsl)
 * 4. Server emits "spa:route" to client(s)
 */
function createSpaSyncServer(options = {}) {
  const actions = createActionRegistry(options.actions);
  const viewStore = createViewStore();

  const onAuthorize =
    typeof options.onAuthorize === "function"
      ? options.onAuthorize
      : () => null;

  const onError =
    typeof options.onError === "function" ? options.onError : () => {};

  const clients = new Map();

  async function registerClient(socket) {
    try {
      const user = await onAuthorize(socket);
      clients.set(socket.id, { socket, user });

      socket.on("message", (packet) => {
        handlePacket(socket, packet).catch((err) => onError(err));
      });

      socket.on("disconnect", () => {
        clients.delete(socket.id);
      });
    } catch (err) {
      onError(err);
      socket.disconnect(true);
    }
  }

  async function handlePacket(socket, packet) {
    if (!packet || packet.type !== "action") return;

    const { name, payload, meta } = packet;
    const fn = actions.get(name);

    if (!fn) {
      socket.emit("spa:error", {
        kind: "spa.error",
        name: "UnknownAction",
        message: "Unknown action: " + name,
        meta,
      });
      return;
    }

    const client = clients.get(socket.id);

    const sendRoute = (dsl) => {
      socket.emit("spa:route", dsl);
    };

    const ctx = createContext({
      socket,
      user: client.user,
      payload: payload || {},
      meta: meta || {},
      viewStore,
      sendRoute,
    });

    try {
      await fn(ctx);
    } catch (err) {
      onError(err, ctx);
      socket.emit("spa:error", {
        kind: "spa.error",
        name: err?.name || "Error",
        message: err?.message || "Unknown error",
        meta,
      });
    }
  }

  return { registerClient, handlePacket, viewStore };
}

module.exports = { createSpaSyncServer };
