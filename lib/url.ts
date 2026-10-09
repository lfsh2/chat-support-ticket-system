/**
 * The address people actually use to reach the app. Behind a proxy (DigitalOcean App
 * Platform), `request.nextUrl.origin` is the container's internal address
 * (e.g. https://localhost:8080), so redirects built from it send browsers nowhere.
 * Prefer the configured app URL, then the proxy's forwarded headers.
 */
export function publicOrigin(request: Request, configured = process.env.NEXT_PUBLIC_APP_URL): string {
  const fromEnv = configured?.trim().replace(/\/+$/, "");
  if (fromEnv && /^https?:\/\/[^/]+$/.test(fromEnv)) return fromEnv;

  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(request.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
