import { NextResponse, type NextRequest } from "next/server";
import { DEV_USERS, canUseDevLogin, signInAsDevUser } from "@/lib/dev-login";

/**
 * Local dev only:  /auth/dev?as=coachos   (optionally &next=/c/wins)
 * 404s unless local dev login is on — see lib/dev-login.ts. Never active in production.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  if (!canUseDevLogin()) return new NextResponse("Not found", { status: 404 });

  const user = DEV_USERS.find((u) => u.slug === searchParams.get("as"));
  if (!user) {
    const list = DEV_USERS.map((u) => `${origin}/auth/dev?as=${u.slug}   (${u.label}, ${u.note})`).join("\n");
    return new NextResponse(`Pick a user:\n\n${list}\n`, { status: 400, headers: { "content-type": "text/plain" } });
  }

  try {
    await signInAsDevUser(user.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new NextResponse(
      `Couldn't sign in as ${user.label}: ${message}\n\nIs the database seeded with the test users (supabase/seed.sql)? Check ${origin}/api/health`,
      { status: 500, headers: { "content-type": "text/plain" } },
    );
  }
  const next = searchParams.get("next") ?? "/";
  return NextResponse.redirect(`${origin}${next.startsWith("/") && !next.startsWith("//") ? next : "/"}`);
}
