// tests/spaSyncServer.usage.test.js

// These tests are intentionally written in a narrative style
// so that they serve as living documentation of how to use the package.

const { createSpaSyncServer } = require("../src/server/createSpaSyncServer");
const { makeActionPacket } = require("../src/protocol/packets");
const { createViewStore } = require("../src/server/viewStore");

// Helper: very small fake Socket.IO socket
function createFakeSocket(id = "socket-1") {
  const handlers = {};
  const emitted = [];

  return {
    id,
    emitted,
    handlers,
    on(event, fn) {
      handlers[event] = fn;
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    trigger(event, payload) {
      if (handlers[event]) {
        handlers[event](payload);
      }
    },
    disconnect: jest.fn(),
  };
}

describe("SpaSync server usage examples", () => {
  test("unknown action results in an error packet sent back to the client", async () => {
    // This test describes how the server reacts when a client sends
    // an action that is not registered in the action registry.

    const spa = createSpaSyncServer({
      actions: {
        // We deliberately leave this empty or unrelated to trigger the error.
      },
    });

    const socket = createFakeSocket("socket-unknown-action");

    // Normally, registerClient is called on socket connection.
    await spa.registerClient(socket);

    // In real life, the client would send this packet over the wire.
    const packet = makeActionPacket(
      "nonExisting.action",
      { foo: 1 },
      { requestId: "req-1" }
    );

    // The server wired a "message" listener on the socket in registerClient.
    // Here we manually trigger it to simulate a real incoming packet.
    socket.trigger("message", packet);

    // We expect the server to emit an error packet back to the same socket.
    const messageEvents = socket.emitted.filter((e) => e.event === "message");
    expect(messageEvents).toHaveLength(1);

    const errorPacket = messageEvents[0].payload;
    expect(errorPacket.type).toBe("error");
    expect(errorPacket.name).toBe("UnknownAction");
    expect(errorPacket.message).toContain("Unknown action");
    expect(errorPacket.meta).toEqual({
      action: "nonExisting.action",
      requestId: "req-1",
    });
  });

  test("a simple action sets a full view snapshot and stores it in the viewStore", async () => {
    // This test shows how to implement a basic action that:
    // 1. Uses ctx.view(viewKey).set(state) to send a full snapshot to the client.
    // 2. Persists the view state in the internal viewStore for later debugging.

    const spa = createSpaSyncServer({
      actions: {
        "counter.reset": async (ctx) => {
          // In a real application, you might initialize a complex view here.
          ctx.view("counter").set({
            value: 0,
            label: "Initial counter state",
          });
        },
      },
    });

    const socket = createFakeSocket("socket-counter-reset");
    await spa.registerClient(socket);

    const packet = makeActionPacket(
      "counter.reset",
      {}, // payload is empty in this example
      { requestId: "reset-1" }
    );

    socket.trigger("message", packet);

    // 1) The server should send a "view:set" packet to the client.
    const viewMessages = socket.emitted.filter((e) => e.event === "message");
    expect(viewMessages).toHaveLength(1);

    const viewPacket = viewMessages[0].payload;
    expect(viewPacket.type).toBe("view");
    expect(viewPacket.kind).toBe("set");
    expect(viewPacket.view).toBe("counter");
    expect(viewPacket.state).toEqual({
      value: 0,
      label: "Initial counter state",
    });
    expect(viewPacket.meta).toEqual({ requestId: "reset-1" });

    // 2) The view state should be available from spa.viewStore for debugging or replay.
    const storedState = spa.viewStore.get("counter");
    expect(storedState).toEqual({
      value: 0,
      label: "Initial counter state",
    });
  });

  test("an action patches an existing view and the viewStore merges the state", async () => {
    // This test demonstrates how partial updates work with ctx.view(viewKey).patch(partial).
    // The viewStore.merge behavior means you get a new object that combines
    // previous state + partial update.

    const spa = createSpaSyncServer({
      actions: {
        "counter.increment": async (ctx) => {
          // We do not need to read the previous state from ctx;
          // we simply provide the delta, and the viewStore will merge it.
          ctx.view("counter").patch({
            value: ctx.payload.nextValue,
          });
        },
      },
    });

    const socket = createFakeSocket("socket-counter-increment");
    await spa.registerClient(socket);

    // First, we simulate an existing state in the viewStore.
    spa.viewStore.set("counter", { value: 1, step: 1 });

    const packet = makeActionPacket(
      "counter.increment",
      { nextValue: 2 },
      { requestId: "inc-1" }
    );

    socket.trigger("message", packet);

    const viewMessages = socket.emitted.filter((e) => e.event === "message");
    expect(viewMessages).toHaveLength(1);

    const patchPacket = viewMessages[0].payload;
    expect(patchPacket.type).toBe("view");
    expect(patchPacket.kind).toBe("patch");
    expect(patchPacket.view).toBe("counter");
    expect(patchPacket.patch).toEqual({ value: 2 });
    expect(patchPacket.meta).toEqual({ requestId: "inc-1" });

    // The viewStore should have merged the new value while keeping "step".
    const storedState = spa.viewStore.get("counter");
    expect(storedState).toEqual({
      value: 2,
      step: 1,
    });
  });

  test("authorization and broadcastToOthers: one user sends a message, others receive it", async () => {
    // This test explains:
    // 1. How onAuthorize is used to attach a 'user' object to each socket.
    // 2. How ctx.emit sends a packet back to the sender.
    // 3. How ctx.broadcastToOthers sends the same packet to all other connected clients.

    const spa = createSpaSyncServer({
      actions: {
        "chat.send": async (ctx) => {
          const packet = {
            type: "chat",
            userId: ctx.user.id,
            text: ctx.payload.text,
          };

          // Send to the sender
          ctx.emit(packet);

          // Send to everyone else
          ctx.broadcastToOthers(packet);
        },
      },
      onAuthorize: async (socket) => {
        // In a real-world app, you would verify a token or session here.
        // For demonstration, we derive a user from the socket id.
        return { id: `user-of-${socket.id}` };
      },
    });

    const aliceSocket = createFakeSocket("socket-alice");
    const bobSocket = createFakeSocket("socket-bob");

    await spa.registerClient(aliceSocket);
    await spa.registerClient(bobSocket);

    // Alice sends a chat message.
    const chatPacket = makeActionPacket(
      "chat.send",
      { text: "Hello, Bob!" },
      { requestId: "chat-1" }
    );

    aliceSocket.trigger("message", chatPacket);

    // Alice should receive her own chat packet (via ctx.emit).
    const aliceMessages = aliceSocket.emitted.filter(
      (e) => e.event === "message"
    );
    expect(aliceMessages).toHaveLength(1);
    expect(aliceMessages[0].payload).toEqual({
      type: "chat",
      userId: "user-of-socket-alice",
      text: "Hello, Bob!",
    });

    // Bob should also receive the packet (via ctx.broadcastToOthers).
    const bobMessages = bobSocket.emitted.filter((e) => e.event === "message");
    expect(bobMessages).toHaveLength(1);
    expect(bobMessages[0].payload).toEqual({
      type: "chat",
      userId: "user-of-socket-alice",
      text: "Hello, Bob!",
    });
  });

  test("viewStore can be used standalone for local state management", () => {
    // This final test illustrates direct usage of createViewStore
    // without involving sockets at all. This is useful when treating
    // the store as an in-memory model of what the client currently sees.

    const viewStore = createViewStore();

    // Set an initial snapshot
    viewStore.set("profile", { name: "Alice", age: 30 });
    expect(viewStore.get("profile")).toEqual({ name: "Alice", age: 30 });

    // Apply a partial patch: only the changed fields need to be specified
    viewStore.patch("profile", { age: 31 });
    expect(viewStore.get("profile")).toEqual({ name: "Alice", age: 31 });

    // Another view can be managed independently
    viewStore.set("dashboard", { widgets: ["chart", "table"] });
    expect(viewStore.get("dashboard")).toEqual({ widgets: ["chart", "table"] });
  });
});
