import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MeshesApiError } from "../src/lib/errors";
import MeshesEventsClient from "../src/client";

const VALID_KEY = "mesh_pub_abc.def_ghi-jkl_suffix123";

type MockFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

function mockResponse(opts: {
  ok: boolean;
  status?: number;
  statusText?: string;
  bodyText?: string;
}): MockFetchResponse {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 400),
    statusText: opts.statusText ?? (opts.ok ? "OK" : "Bad Request"),
    text: async () => opts.bodyText ?? "",
  };
}

describe("MeshesEventsClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on invalid publishable key", () => {
    expect(() => new MeshesEventsClient("bad_key" as any)).toThrow(
      MeshesApiError
    );
  });

  it("throws on null options", () => {
    expect(() => new MeshesEventsClient(VALID_KEY, null as any)).toThrow(
      MeshesApiError
    );
  });

  it("injects X-Meshes-Publishable-Key header", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await client.emit({
      event: "signup",
      payload: { email: "a@b.com" },
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (globalThis.fetch as any).mock.calls[0];

    expect(init.headers["X-Meshes-Publishable-Key"]).toBe(VALID_KEY);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.method).toBe("POST");
  });

  it("emit() validates payload.email", () => {
    const client = new MeshesEventsClient(VALID_KEY);

    expect(() =>
      client.emit({ event: "x", payload: {} as any } as any)
    ).toThrow(MeshesApiError);

    expect(() =>
      client.emit({ event: "x", payload: { email: "   " } as any } as any)
    ).toThrow(MeshesApiError);
  });

  it("emitBatch() validates array and size", () => {
    const client = new MeshesEventsClient(VALID_KEY);

    expect(() => client.emitBatch("nope" as any)).toThrow(MeshesApiError);
    expect(() => client.emitBatch([] as any)).toThrow(MeshesApiError);

    const many = Array.from({ length: 101 }, () => ({
      event: "x",
      payload: { email: "a@b.com" },
    }));

    expect(() => client.emitBatch(many as any)).toThrow(MeshesApiError);
  });

  it("returns parsed JSON for success responses", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"id":"evt_1"}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);
    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).resolves.toEqual({ id: "evt_1" });
  });

  it("returns text for success non-JSON responses", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: "OK" })
    );

    const client = new MeshesEventsClient(VALID_KEY);
    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).resolves.toBe("OK");
  });

  it("returns null for empty success body", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: "" })
    );

    const client = new MeshesEventsClient(VALID_KEY);
    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).resolves.toBeNull();
  });

  it("throws MeshesApiError with status and data on non-2xx", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        bodyText: '{"error":"nope"}',
      })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    try {
      await client.emit({ event: "x", payload: { email: "a@b.com" } });
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err).toBeInstanceOf(MeshesApiError);
      expect(err.data.status).toBe(401);
      expect(err.data.statusText).toBe("Unauthorized");
      expect(err.data.data).toEqual({ error: "nope" });
    }
  });

  it("supports callback style (no promise returned)", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await new Promise<void>((resolve, reject) => {
      const ret = client.emit(
        { event: "x", payload: { email: "a@b.com" } },
        {},
        (err: any, data?: any) => {
          try {
            expect(ret).toBeUndefined();
            expect(err).toBeNull();
            expect(data).toEqual({ ok: true });
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  });

  it("aborts on timeout (AbortController present)", async () => {
    // Mock fetch that listens to AbortSignal and rejects like real fetch
    (globalThis.fetch as any).mockImplementation((_url: any, init: any) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("AbortError"))
        );
      });
    });

    const client = new MeshesEventsClient(VALID_KEY, { timeout: 5000 });

    const p = client.emit({ event: "x", payload: { email: "a@b.com" } });

    vi.advanceTimersByTime(6000);

    await expect(p).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("works without AbortController (no signal)", async () => {
    const original = globalThis.AbortController;
    (globalThis as any).AbortController = undefined;

    try {
      (globalThis.fetch as any).mockResolvedValue(
        mockResponse({ ok: true, bodyText: '{"ok":true}' })
      );

      const client = new MeshesEventsClient(VALID_KEY);
      await client.emit({ event: "x", payload: { email: "a@b.com" } });

      const [, init] = (globalThis.fetch as any).mock.calls[0];
      expect(init.signal).toBeUndefined();
    } finally {
      (globalThis as any).AbortController = original;
    }
  });

  it("calls fetch with the correct URL + init params", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    const event = {
      event: "user.signed_up",
      resource: "user",
      resource_id: "u_123",
      payload: { email: "a@b.com", name: "Test" },
    };

    await client.emit(event);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (globalThis.fetch as any).mock.calls[0];

    // URL
    expect(url).toBe("https://events.meshes.io/api/v1/events");

    // Method
    expect(init.method).toBe("POST");

    // Headers (check the critical ones)
    expect(init.headers).toEqual(
      expect.objectContaining({
        "X-Meshes-Publishable-Key": VALID_KEY,
        "X-Meshes-Client": expect.any(String),
        "Content-Type": "application/json",
        Accept: "application/json",
      })
    );

    // Body
    expect(init.body).toBe(JSON.stringify(event));

    // Abort signal present (node18+ has AbortController globally; your code guards for older)
    // If AbortController exists, signal should exist; otherwise it may be undefined.
    if (globalThis.AbortController) {
      expect(init.signal).toBeDefined();
    }
  });

  it("appends query params to the URL when provided", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await (client as any).emit(
      { event: "x", payload: { email: "a@b.com" } },
      { query: { foo: "bar", baz: "qux" } }
    );

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toMatch(/^https:\/\/events\.meshes\.io\/api\/v1\/events\?/);
    expect(url).toContain("foo=bar");
    expect(url).toContain("baz=qux");
  });

  it("merges additional headers but does not allow overriding forbidden headers", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    // test invalid headers
    expect(
      () =>
        new MeshesEventsClient(VALID_KEY, {
          headers: { "Content-Type": "x" } as any,
        })
    ).toThrow(MeshesApiError);

    // test valid headers
    const client = new MeshesEventsClient(VALID_KEY, {
      headers: {
        "X-Request-Id": "req_123",
        "Idempotency-Key": "idem_456",
      } as any,
    });

    await client.emit({ event: "x", payload: { email: "a@b.com" } });

    const [, init] = (globalThis.fetch as any).mock.calls[0];

    expect(init.headers).toEqual(
      expect.objectContaining({
        "X-Request-Id": "req_123",
        "Idempotency-Key": "idem_456",
      })
    );

    // still your enforced contract headers
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Meshes-Publishable-Key"]).toBe(VALID_KEY);
  });

  it("throws on unsupported version", () => {
    expect(
      () => new MeshesEventsClient(VALID_KEY, { version: "v2" as any })
    ).toThrow(MeshesApiError);
  });

  it("throws on invalid timeout type", () => {
    expect(
      () => new MeshesEventsClient(VALID_KEY, { timeout: "x" as any })
    ).toThrow(MeshesApiError);
  });

  it("throws on timeout out of bounds", () => {
    expect(() => new MeshesEventsClient(VALID_KEY, { timeout: 999 })).toThrow(
      MeshesApiError
    );
    expect(() => new MeshesEventsClient(VALID_KEY, { timeout: 30001 })).toThrow(
      MeshesApiError
    );
  });

  it("uses apiBaseUrl override", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY, {
      apiBaseUrl: "https://example.test/api/v1",
    } as any);

    await client.emit({ event: "x", payload: { email: "a@b.com" } });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://example.test/api/v1/events");
  });

  it("emit() validates event shape", () => {
    const client = new MeshesEventsClient(VALID_KEY);

    expect(() => client.emit(null as any)).toThrow(MeshesApiError);
    expect(() => client.emit({ payload: { email: "a@b.com" } } as any)).toThrow(
      MeshesApiError
    );
    expect(() =>
      client.emit({ event: "   ", payload: { email: "a@b.com" } } as any)
    ).toThrow(MeshesApiError);
    expect(() => client.emit({ event: "x", payload: null } as any)).toThrow(
      MeshesApiError
    );
  });

  it("throws on invalid query param shape", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    // query cannot be array
    await expect(
      (client as any).emit(
        { event: "x", payload: { email: "a@b.com" } },
        { query: ["nope"] }
      )
    ).rejects.toBeInstanceOf(MeshesApiError);

    // query cannot be null
    await expect(
      (client as any).emit(
        { event: "x", payload: { email: "a@b.com" } },
        { query: null }
      )
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("wraps errors when reading success body fails", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => {
        throw new Error("boom");
      },
    });

    const client = new MeshesEventsClient(VALID_KEY);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("wraps errors when reading error body fails", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => {
        throw new Error("boom");
      },
    });

    const client = new MeshesEventsClient(VALID_KEY);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("wraps fetch network errors", async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error("NetworkDown"));

    const client = new MeshesEventsClient(VALID_KEY);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("callback style receives error on non-2xx", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        bodyText: '{"e":1}',
      })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await new Promise<void>((resolve, reject) => {
      const ret = client.emit(
        { event: "x", payload: { email: "a@b.com" } },
        {},
        (err: any, data?: any) => {
          try {
            expect(ret).toBeUndefined();
            expect(err).toBeInstanceOf(MeshesApiError);
            expect(data).toBeUndefined();
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  });

  it("rejects forbidden headers in options.headers (constructor)", () => {
    expect(
      () =>
        new MeshesEventsClient(VALID_KEY, {
          headers: { "X-Meshes-Client": "evil" } as any,
        })
    ).toThrow(MeshesApiError);
  });

  it("cleans additional headers (trims, drops empties)", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY, {
      headers: {
        " X-Request-Id ": " req_1 ",
        "   ": "x", // empty key after trim -> dropped
        "X-Empty": "   ", // empty value after trim -> dropped
      } as any,
    });

    await client.emit({ event: "x", payload: { email: "a@b.com" } });

    const [, init] = (globalThis.fetch as any).mock.calls[0];

    expect(init.headers["X-Request-Id"]).toBe("req_1");
    expect(init.headers["X-Empty"]).toBeUndefined();
  });

  it("throws if options.headers includes a forbidden header", () => {
    expect(
      () =>
        new MeshesEventsClient(VALID_KEY, {
          headers: { "X-Meshes-Client": "evil" } as any,
        })
    ).toThrow(MeshesApiError);
  });

  it("trims additional headers and drops empties", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY, {
      headers: {
        " X-Request-Id ": " req_1 ",
        "": "x",
        "   ": "y",
      } as any,
    });

    await client.emit({ event: "x", payload: { email: "a@b.com" } });

    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(init.headers["X-Request-Id"]).toBe("req_1");
  });

  it("drops forbidden per-request headers (cannot override contract headers)", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await client.emit({ event: "x", payload: { email: "a@b.com" } }, {
      headers: {
        "Content-Type": "text/plain", // forbidden override
        " X-Request-Id ": " req_99 ",
      } as any,
    } as any);

    const [, init] = (globalThis.fetch as any).mock.calls[0];

    // still enforced
    expect(init.headers["Content-Type"]).toBe("application/json");
    // allowed header trimmed
    expect(init.headers["X-Request-Id"]).toBe("req_99");
  });

  it("debug=true emits console.debug logs", async () => {
    const dbg = vi.spyOn(console, "debug").mockImplementation(() => {});
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY, { debug: true } as any);
    await client.emit({ event: "x", payload: { email: "a@b.com" } });

    expect(dbg).toHaveBeenCalled();
  });

  it("debug=true emits console.error on failures", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (globalThis.fetch as any).mockRejectedValue(new Error("NetworkDown"));

    const client = new MeshesEventsClient(VALID_KEY, { debug: true } as any);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } })
    ).rejects.toBeInstanceOf(MeshesApiError);

    expect(errSpy).toHaveBeenCalled();
  });

  it("rejects invalid per-request timeout type", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );
    const client = new MeshesEventsClient(VALID_KEY);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } }, {
        timeout: "nope" as any,
      } as any)
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("rejects per-request timeout out of bounds", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );
    const client = new MeshesEventsClient(VALID_KEY);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } }, {
        timeout: 999,
      } as any)
    ).rejects.toBeInstanceOf(MeshesApiError);

    await expect(
      client.emit({ event: "x", payload: { email: "a@b.com" } }, {
        timeout: 30001,
      } as any)
    ).rejects.toBeInstanceOf(MeshesApiError);
  });

  it("skips invalid per-request header entries (non-string values)", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY, { debug: true } as any);

    await client.emit({ event: "x", payload: { email: "a@b.com" } }, {
      headers: {
        "X-Request-Id": "req_ok",
        "X-Not-String": 123 as any, // should be skipped
      },
    } as any);

    const [, init] = (globalThis.fetch as any).mock.calls[0];

    expect(init.headers["X-Request-Id"]).toBe("req_ok");
    expect(init.headers["X-Not-String"]).toBeUndefined();
  });

  it("drops forbidden per-request headers (does not throw)", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      mockResponse({ ok: true, bodyText: '{"ok":true}' })
    );

    const client = new MeshesEventsClient(VALID_KEY);

    await client.emit({ event: "x", payload: { email: "a@b.com" } }, {
      headers: {
        "X-Meshes-Client": "evil", // should be dropped
        "X-Meshes-Publishable-Key": "evil", // should be dropped
        Accept: "text/plain", // dropped (forbidden)
        "X-Request-Id": "req_1",
      },
    } as any);

    const [, init] = (globalThis.fetch as any).mock.calls[0];

    expect(init.headers["X-Request-Id"]).toBe("req_1");
    expect(init.headers["X-Meshes-Client"]).toMatch(/^Meshes Events Client/);
    expect(init.headers["X-Meshes-Publishable-Key"]).toBe(VALID_KEY);
    expect(init.headers["Accept"]).toBe("application/json");
  });
});
