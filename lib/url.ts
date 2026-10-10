/**
 * The address people actually use to reach the app. Behind a proxy (DigitalOcean App
 * Platform), `request.nextUrl.origin` is the container's internal address
 * (e.g. https://localhost:8080), so redirects built from it send browsers nowhere.
 * Prefer the configured app URL, then the proxy's forwarded headers.
 */
export function publicOrigin(request: Request, configured = process.env.NEXT_PUBLIC_APP_URL): string {
  return originFromHeaders(request.headers, request.url, configured);
}

/** Same, from a header list (server actions get `headers()`, not a Request). */
export function originFromHeaders(
  headers: Headers,
  fallbackUrl?: string,
  configured = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const fromEnv = configured?.trim().replace(/\/+$/, "");
  // An unfilled placeholder ("https://REPLACE-WITH-YOUR-APP-URL") is ignored rather than trusted.
  if (fromEnv && /^https?:\/\/[^/]+$/.test(fromEnv) && !/replace-with/i.test(fromEnv)) return fromEnv;

  const host = headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host");
  if (host) {
    const proto =
      headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      (fallbackUrl ? new URL(fallbackUrl).protocol.replace(":", "") : "https");
    return `${proto}://${host}`;
  }
  return fallbackUrl ? new URL(fallbackUrl).origin : "";
}
