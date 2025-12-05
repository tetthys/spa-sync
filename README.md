# `@tetthys/spa-sync`

A lightweight backend runtime that emits **ECOSYSTEM_DSL-compliant `spa.route` packets** to keep your SPA synchronized with server-driven UI state.
It handles **action dispatch**, **view payload management**, and **Socket.IO transport**.

---

## Table of Contents

1. [Installation](#installation)
2. [Overview](#overview)
3. [Basic Example](#basic-example)
4. [Action Handlers](#action-handlers)
5. [Using `ctx.view().show()`](#using-ctxviewshow)
6. [Using `ctx.emitRoute()`](#using-ctxemitroute)
7. [Authorization & Error Handling](#authorization--error-handling)
8. [Socket.IO Integration](#socketio-integration)
9. [Testing Utilities](#testing-utilities)
10. [API Reference](#api-reference)

---

## Installation

```bash
npm install @tetthys/spa-sync
```

or:

```bash
yarn add @tetthys/spa-sync
```

---

## Overview

`spa-sync` follows a simple lifecycle:

1. The client sends an **action packet**:
   `{ type: "action", name, payload, meta }`.
2. The server resolves and executes the corresponding action handler.
3. The handler calls:

   * `ctx.view("key").show(payload)` (recommended), or
   * `ctx.emitRoute(dsl)` (manual DSL mode).
4. The server emits a standardized **spa.route DSL packet** to the client.
5. The SPA updates based on the server-driven UI payload.

This makes your frontend behave as a **pure function of server state**, similar to classic monolithic frameworks (Laravel / Rails), but in a real-time SPA environment.

---

## Basic Example

### `server.js`

```js
const { createSpaSyncServer, attachToSocketIO } = require("@tetthys/spa-sync");
const { Server } = require("socket.io");

const io = new Server(3000);

const spa = createSpaSyncServer({
  actions: {
    "counter.increment": async (ctx) => {
      const next = (ctx.payload.value || 0) + 1;
      ctx.view("counter").show({ value: next });
    },
  },
});

attachToSocketIO(io, spa);

console.log("SPA Sync running on :3000");
```

### Client emits:

```js
socket.emit("message", {
  type: "action",
  name: "counter.increment",
  payload: { value: 1 },
  meta: { requestId: "req1" }
});
```

The server responds with a **spa.route** packet.

---

## Action Handlers

Action handlers always receive a single `ctx` object:

```js
async function(ctx) {
  // ctx.socket
  // ctx.user
  // ctx.payload
  // ctx.meta
  // ctx.view(viewKey).show(payload)
  // ctx.emitRoute(dsl)
}
```

Example:

```js
"login.submit": async (ctx) => {
  if (ctx.payload.email === "demo@example.com") {
    ctx.view("dashboard").show({ username: "Demo User" });
  } else {
    ctx.view("login").show({ error: "Invalid credentials" });
  }
};
```

---

## Using `ctx.view().show()`

This is the recommended way to update a view.

```js
ctx.view("profile").show({ username: "kim" });
```

It:

* Stores the payload internally in the view store.
* Automatically builds a compliant **spa.route DSL** packet.
* Emits it to the client.

Resulting DSL (simplified):

```json
{
  "kind": "spa.route",
  "navigation": null,
  "view": { "key": "profile", "props": {} },
  "payload": { "username": "kim" },
  "flashes": {},
  "meta": { "viewKey": "profile" }
}
```

---

## Using `ctx.emitRoute()`

Use this when you need full control over the DSL.

```js
ctx.emitRoute({
  navigation: { action: "redirect", target: "home" },
  view: { key: "home", props: {} },
  payload: { loggedIn: true },
  flashes: { notice: "Welcome!" },
  meta: { requestId: ctx.meta.requestId }
});
```

---

## Authorization & Error Handling

### Authorization

```js
const spa = createSpaSyncServer({
  onAuthorize: async (socket) => {
    return { id: socket.id }; // attach user object
  }
});
```

### Error Handling

```js
const spa = createSpaSyncServer({
  onError: (err, ctx) => {
    console.error("SPA-Sync error:", err);
  }
});
```

If an uncaught error occurs, the client automatically receives:

```json
{
  "kind": "spa.error",
  "name": "Error",
  "message": "...",
  "meta": { ... }
}
```

---

## Socket.IO Integration

```js
const { attachToSocketIO } = require("@tetthys/spa-sync");

attachToSocketIO(io, spa);
```

This automatically calls `spa.registerClient(socket)` on each connection.

---

## Testing Utilities

`spa-sync` includes protocol helpers:

```js
const {
  makeActionPacket,
  makeRoutePacket
} = require("@tetthys/spa-sync");

const action = makeActionPacket("user.update", { name: "Kim" }, { req: 1 });

const dsl = makeRoutePacket({
  view: { key: "test" },
  payload: { ok: true }
});
```

Useful for unit testing or building custom clients.

---

## API Reference

### `createSpaSyncServer(options)`

| Option                | Description            |
| --------------------- | ---------------------- |
| `actions`             | Map of action handlers |
| `onAuthorize(socket)` | Optional user resolver |
| `onError(err, ctx)`   | Optional error logger  |

Returns:

```ts
{
  registerClient(socket),
  handlePacket(socket, packet),
  viewStore
}
```

---

### `ctx.view(viewKey).show(payload)`

* Stores payload in `viewStore`.
* Sends an auto-generated spa.route packet.

### `ctx.emitRoute(dsl)`

Manually emit a complete ECOSYSTEM_DSL object.

### `makeRoutePacket(dsl)`

Builds a standardized `spa.route` packet.

### `makeActionPacket(name, payload, meta)`

Builds a client → server action packet.

### `attachToSocketIO(io, spa)`

Wires the SPA engine to a Socket.IO server instance.

---

## Minimal Example: Counter

```js
const { createSpaSyncServer, attachToSocketIO } = require("@tetthys/spa-sync");
const { Server } = require("socket.io");

const io = new Server(3000);

const spa = createSpaSyncServer({
  actions: {
    "counter.inc": async (ctx) => {
      const current = ctx.viewStore.get("counter")?.value || 0;
      ctx.view("counter").show({ value: current + 1 });
    },
  }
});

attachToSocketIO(io, spa);
```