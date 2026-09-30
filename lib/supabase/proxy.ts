import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { DEMO_COOKIE, DEMO_OFFLINE } from "@/lib/demo/config";

const PUBLIC_PATHS = ["/login", "/auth", "/access-ended", "/api/webhooks", "/api/cron", "/api/health", "/api/demo"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Refreshes the Supabase session cookie and sends signed-out visitors to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Offline demo: the signed-in user is just a cookie; no Supabase session to refresh.
  if (DEMO_OFFLINE) return route(request, response, Boolean(request.cookies.get(DEMO_COOKIE)?.value));

  // Misconfigured deploy: let public pages (login, /api/health) render instead of a blank 500.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase env vars are missing — see /api/health");
    return isPublic(request.nextUrl.pathname) ? response : NextResponse.redirect(new URL("/api/health", request.url));
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Must run before any redirect so the refreshed cookie is written.
  const { data } = await supabase.auth.getClaims();
  return route(request, response, Boolean(data?.claims));
}

function route(request: NextRequest, response: NextResponse, signedIn: boolean) {
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
