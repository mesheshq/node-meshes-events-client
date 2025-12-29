import { describe, it, expect } from "vitest";
import { readBody } from "../lib/helpers.js";

function makeResponse(textValue: string) {
  return {
    text: async () => textValue,
  } as any;
}

describe("readBody", () => {
  it("returns null for empty body", async () => {
    await expect(readBody(makeResponse(""))).resolves.toBeNull();
  });

  it("parses JSON when body is JSON", async () => {
    await expect(readBody(makeResponse('{"ok":true}'))).resolves.toEqual({
      ok: true,
    });
  });

  it("falls back to text when body is not JSON", async () => {
    await expect(readBody(makeResponse("not json"))).resolves.toBe("not json");
  });
});
