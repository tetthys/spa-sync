// tests/docs/02-auth-and-broadcasting.test.js
// Doc-style test: authorization and conceptual broadcasting.

const { createSpaSyncServer, makeActionPacket } = require("../..");

function createFakeSocket(id, userPayload = {}) {
  const handlers = {};
  const emitted = [];

  return {
    id,
    userPayload,

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

    disconnect() {},

    _handlers: handlers,
    _emitted: emitted,
  };
}

describe("02 – authorization and broadcasting", () => {
  it("uses onAuthorize and demonstrates broadcasting semantics", async () => {
    // 1) Server with authorization and two actions:
    //    - chat.self: send message only to self
    //    - chat.broadcastOthers: send message to everyone except self
    const spa = createSpaSyncServer({
      actions: {
        "chat.self": async (ctx) => {
          // Send a message only to the current user.
          ctx.view("chat").show({
            from: ctx.user.id,
            text: ctx.payload.text,
            scope: "self",
          });
        },

        "chat.broadcastOthers": async (ctx) => {
          // Conceptual API: broadcastToOthers(dsl)
          // This assumes the underlying server injects such a helper into ctx.
          if (typeof ctx.broadcastToOthers === "function") {
            ctx.broadcastToOthers({
              navigation: null,
              view: { key: "chat", props: {} },
              payload: {
                from: ctx.user.id,
                text: ctx.payload.text,
                scope: "others",
              },
              flashes: {},
              meta: { channel: "chat" },
            });
          }
        },
      },

      // Attach a user to each socket based on its "userPayload" field.
      onAuthorize: async (socket) => {
        // In real apps, this would check a token or session.
        return {
          id: socket.userPayload.userId,
          name: socket.userPayload.name,
        };
      },
    });

    // 2) Two clients: alice and bob.
    const alice = createFakeSocket("socket-alice", {
      userId: "alice",
      name: "Alice",
    });
    const bob = createFakeSocket("socket-bob", {
      userId: "bob",
      name: "Bob",
    });

    await spa.registerClient(alice);
    await spa.registerClient(bob);

    // 3) alice sends a "self" message.
    const selfPacket = makeActionPacket(
      "chat.self",
      { text: "hello (self)" },
      { requestId: "self-1" }
    );
    alice.trigger("message", selfPacket);

    const aliceRoutesAfterSelf = alice._emitted.filter(
      (e) => e.event === "spa:route"
    );
    const bobRoutesAfterSelf = bob._emitted.filter(
      (e) => e.event === "spa:route"
    );

    expect(aliceRoutesAfterSelf.length).toBe(1);
    expect(bobRoutesAfterSelf.length).toBe(0);

    expect(aliceRoutesAfterSelf[0].payload.payload).toEqual({
      from: "alice",
      text: "hello (self)",
      scope: "self",
    });

    // 4) alice sends a broadcast to others.
    const broadcastPacket = makeActionPacket(
      "chat.broadcastOthers",
      { text: "hello (others)" },
      { requestId: "bcast-1" }
    );
    alice.trigger("message", broadcastPacket);

    const aliceRoutes = alice._emitted.filter((e) => e.event === "spa:route");
    const bobRoutes = bob._emitted.filter((e) => e.event === "spa:route");

    // After previous self-message:
    //   - alice had 1 spa.route
    //   - bob had 0 spa.route
    // Now, after broadcast to others, we expect:
    //   - bob to have at least 1 spa.route (from broadcast)
    expect(bobRoutes.length).toBeGreaterThanOrEqual(1);

    const lastForBob = bobRoutes[bobRoutes.length - 1].payload;
    expect(lastForBob.kind).toBe("spa.route");
    expect(lastForBob.payload).toEqual({
      from: "alice",
      text: "hello (others)",
      scope: "others",
    });
  });
});
