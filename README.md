# meshes-events-client (@mesheshq/events)

[![Tests](https://github.com/mesheshq/node-meshes-events-client/actions/workflows/tests.yml/badge.svg)](https://github.com/mesheshq/node-meshes-events-client/actions/workflows/tests.yml)
[![NPM Version][npm-version-image]][npm-url]
[![NPM Install Size][npm-install-size-image]][npm-install-size-url]

A minimal JavaScript client for emitting events into **Meshes** using a **publishable key**.

This package is designed to be tiny and predictable:

- Supports **Promise**, **async/await**, and **callback** styles
- Works with both **ESM** and **CommonJS**
- Allows safe custom headers (with contract headers protected)
- Optional timeout support using `AbortController` when available

## Installation

```bash
npm i @mesheshq/events
# or
pnpm add @mesheshq/events
# or
yarn add @mesheshq/events
```

## Quick Start

The package exports:

- `MeshesEventsClient` (default export + named export)
- `MeshesApiError`

```js
// CommonJS
// const { MeshesEventsClient } = require("@mesheshq/events");

// ESM
import MeshesEventsClient, {
  MeshesEventsClient as NamedClient,
} from "@mesheshq/events";

const publishableKey = process.env.WORKSPACE_PUBLISHABLE_KEY!;
const client = new MeshesEventsClient(publishableKey);

// Promise style
client
  .emit({
    event: "user.signed_up",
    payload: { email: "a@b.com" },
  })
  .then((result) => {
    // success handling
  })
  .catch((err) => {
    // error handling
  });

// Using async/await
try {
  const result = await client.emit({
    event: "user.signed_up",
    payload: { email: "a@b.com" },
  });

  // success handling
} catch (err) {
  // error handling
}
```

### Callback style (no Promise returned)

If you provide a callback, the method returns `undefined` and invokes the callback when complete.

```js
client.emit(
  { event: "user.signed_up", payload: { email: "a@b.com" } },
  {},
  function (err, result) {
    if (err) {
      // error handling
    } else {
      // success handling
    }
  }
);
```

## Publishable Key Format

Publishable keys can be found in the workspace settings and must be in a valid format

Example:

```
mesh_pub_abc.def_ghi-jkl_asdf123
```

If the publishable key is missing or invalid, the client throws a `MeshesApiError` immediately when constructing the client.

## Usage

### Initialization

```js
import MeshesEventsClient from "@mesheshq/events";

const client = new MeshesEventsClient(process.env.WORKSPACE_PUBLISHABLE_KEY!, {
  version: "v1", // only "v1" currently supported
  timeout: 10000, // 1000..30000 ms
  debug: false, // logs to console.debug / console.error when true

  // Optional: extra default headers applied to all requests
  headers: {
    "X-Request-Id": "req_123",
  },
});
```

### Emitting a Single Event

```js
await client.emit({
  event: "user.signed_up",
  payload: {
    email: "a@b.com",
    name: "Test User",
  },
});
```

### Emitting a Batch of Events

Batch requests support up to **100 events** per call.

```js
await client.emitBatch([
  { event: "user.signed_up", payload: { email: "a@b.com" } },
  { event: "membership.started", payload: { email: "a@b.com", tier: "pro" } },
]);
```

## Request Options

Both `emit()` and `emitBatch()` accept an optional `options` object:

```js
await client.emit(
  { event: "x", payload: { email: "a@b.com" } },
  {
    // Add request-specific headers
    headers: {
      "Idempotency-Key": "idem_456",
      "X-Request-Id": "req_789",
    },

    // Override timeout for this call only (1000..30000 ms)
    timeout: 15000,
  }
);
```

### Protected / Forbidden Headers

To keep the API contract consistent, the following headers cannot be overridden via `options.headers`:

- `X-Meshes-Publishable-Key`
- `X-Meshes-Client`
- `Content-Type`
- `Accept`

If you pass these in **constructor** `headers`, the client throws a `MeshesApiError`.

If you pass them in **per-request** `options.headers`, they are silently dropped (and the client’s contract headers remain in effect).

## Errors

All client errors are thrown as `MeshesApiError`.

```js
import MeshesEventsClient, { MeshesApiError } from "@mesheshq/events";

try {
  const client = new MeshesEventsClient(process.env.WORKSPACE_PUBLISHABLE_KEY!);
  await client.emit({ event: "x", payload: { email: "a@b.com" } });
} catch (err) {
  if (err instanceof MeshesApiError) {
    // `err.data` may include HTTP status, response body, etc.
    console.error("Meshes error:", err.message, err.data);
  } else {
    console.error("Unexpected error:", err);
  }
}
```

### HTTP Failures

If the Meshes API returns a non-2xx response, the client throws `MeshesApiError` and includes:

```js
err.data = {
  status: 401,
  statusText: "Unauthorized",
  data: { ...parsedResponseBodyOrText },
};
```

## Response Body Parsing

Responses are parsed as:

- JSON (if the response body is valid JSON)
- otherwise plain text
- `null` if the response body is empty

## Timeouts and AbortController

Timeout support uses `AbortController` when available (modern Node versions have it globally).  
If `AbortController` is not available, requests still work, but timeouts cannot be enforced by aborting the request.

Timeout range: **1000ms** to **30000ms**.

## Node / Runtime Notes

This client uses `fetch`. Ensure your runtime provides a global `fetch`:

- Node 18+ has global `fetch`
- For Node 16/17 you may need a polyfill (e.g. `undici`) or run in an environment that provides it

## License

MIT

[npm-install-size-image]: https://badgen.net/packagephobia/publish/@mesheshq/events?cache=250&v1.0.7
[npm-install-size-url]: https://packagephobia.com/result?p=%40mesheshq%2Fevents
[npm-url]: https://www.npmjs.com/package/@mesheshq/events
[npm-version-image]: https://badgen.net/npm/v/@mesheshq/events?cache=250&v1.0.7
