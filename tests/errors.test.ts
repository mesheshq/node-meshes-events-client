import { describe, it, expect } from "vitest";
import { MeshesApiError } from "../src/lib/errors";

describe("MeshesApiError", () => {
  it("constructs with message only", () => {
    const err = new MeshesApiError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MeshesApiError");
    expect(err.message).toBe("boom");
    expect(err.data).toBeUndefined();
    expect(err.stack).toBeDefined();
  });

  it("constructs with data", () => {
    const err = new MeshesApiError("boom", { error: "This is an error" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MeshesApiError");
    expect(err.message).toBe("boom");
    expect(err.data).toBeDefined();
    // @ts-expect-error -- valid test
    expect(err.data.error).toBe("This is an error");
    expect(err.stack).toBeDefined();
  });

  it("constructs with stack", () => {
    const err = new MeshesApiError("boom");
    const json = err.toJSON(true);
    expect(json.name).toBe("MeshesApiError");
    expect(json.message).toBe("boom");
    expect(json.data).toBeUndefined();
    expect(json.stack).toBeDefined();
  });

  it("toJSON(false) omits stack", () => {
    const err = new MeshesApiError("boom", { a: 1 });
    const json = err.toJSON(false);

    expect(json.name).toBe("MeshesApiError");
    expect(json.message).toBe("boom");
    expect(json.data).toEqual({ a: 1 });
    expect(json.stack).toBeUndefined();
  });

  it("constructs with message + data", () => {
    const payload = { a: 1 };
    const err = new MeshesApiError("boom", payload);
    expect(err.data).toEqual(payload);
  });
});
