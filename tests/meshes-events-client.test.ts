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
    expect(url).toBe("https://api.meshes.io/api/v1/events");

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
    expect(url).toMatch(/^https:\/\/api\.meshes\.io\/api\/v1\/events\?/);
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
});
