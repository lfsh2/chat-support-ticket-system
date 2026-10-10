import { describe, expect, it } from "vitest";
import { originFromHeaders, publicOrigin } from "./url";

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

describe("originFromHeaders", () => {
  it("ignores an unfilled placeholder and uses the forwarded host", () => {
    const h = new Headers({ "x-forwarded-host": "chat.example.app", "x-forwarded-proto": "https", host: "localhost:8080" });
    expect(originFromHeaders(h, "http://localhost:8080/", "https://REPLACE-WITH-YOUR-APP-URL")).toBe("https://chat.example.app");
  });
  it("still prefers a real configured URL", () => {
    const h = new Headers({ host: "localhost:8080" });
    expect(originFromHeaders(h, undefined, "https://hub.example.com")).toBe("https://hub.example.com");
  });
  it("defaults to https when there is no request URL", () => {
    expect(originFromHeaders(new Headers({ host: "hub.example.com" }), undefined, "")).toBe("https://hub.example.com");
  });
});
