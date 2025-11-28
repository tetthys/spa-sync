// tests/docs/01-minimal-usage.test.js
// Doc-style test: minimal usage of the spa-sync server.

const { createSpaSyncServer, makeActionPacket } = require("../..");

// Very small fake Socket.IO-like socket for tests.
function createFakeSocket(id) {
  const handlers = {};
  const emitted = [];

  return {
    id,

    on(event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },

    emit(event, payload) {
      emitted.push({ event, payload });
    },

    trigger(event, payload) {
      (handlers[event] || []).forEach((h) => h(payload));
    },

    disconnect() {
      // no-op for tests
    },

    // Introspection for assertions
    _handlers: handlers,
    _emitted: emitted,
  };
}

describe("01 – minimal usage", () => {
  it("handles a simple counter.increment action and emits a spa.route DSL", async () => {
    // 1) Create server with a single action.
    const spa = createSpaSyncServer({
      actions: {
        "counter.increment": async (ctx) => {
          // ctx.payload is the incoming payload from the client.
          // ctx.view("counter").show(...) sends a spa.route DSL packet.
          const nextValue = ctx.payload.value;
          ctx.view("counter").show({ value: nextValue });
        },
      },
    });

    // 2) Create a fake socket and register it.
    const socket = createFakeSocket("socket-1");
    await spa.registerClient(socket);

    // 3) Build an action packet and send it via the fake socket.
    const packet = makeActionPacket(
      "counter.increment",
      { value: 42 },
      { requestId: "req-1" }
    );

    // The server listens on "message" packets from the socket.
    socket.trigger("message", packet);

    // 4) The server should emit exactly one spa.route DSL packet.
    const routeMessages = socket._emitted.filter(
      (e) => e.event === "spa:route"
    );
    expect(routeMessages.length).toBe(1);

    const dsl = routeMessages[0].payload;

    // 5) Assert basic ECOSYSTEM_DSL shape.
    expect(dsl.kind).toBe("spa.route");
    expect(dsl.view).toEqual({ key: "counter", props: {} });
    expect(dsl.payload).toEqual({ value: 42 });
    expect(dsl.flashes).toEqual({});
    expect(dsl.meta.viewKey).toBe("counter");
  });
});
