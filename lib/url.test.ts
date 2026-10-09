import { describe, expect, it } from "vitest";
import { publicOrigin } from "./url";

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("publicOrigin", () => {
  it("prefers the configured app URL over the internal address", () => {
    expect(publicOrigin(req("https://localhost:8080/auth/confirm"), "https://hub.example.com/")).toBe("https://hub.example.com");
  });

  it("falls back to the proxy's forwarded host and protocol", () => {
    const r = req("http://localhost:8080/auth/confirm", {
      "x-forwarded-host": "chat.example.app",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(r, undefined)).toBe("https://chat.example.app");
  });

  it("takes the first value when proxies chain headers", () => {
    const r = req("http://localhost:8080/", { "x-forwarded-host": "a.example.app, b.internal", "x-forwarded-proto": "https, http" });
    expect(publicOrigin(r, "")).toBe("https://a.example.app");
  });

  it("ignores a malformed configured URL", () => {
    const r = req("http://localhost:3000/", { host: "localhost:3000" });
    expect(publicOrigin(r, "hub.example.com/path")).toBe("http://localhost:3000");
  });
});
