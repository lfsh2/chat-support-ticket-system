import { NextResponse, type NextRequest } from "next/server";
import { DEV_USERS, devLoginEnabled, signInAsDevUser } from "@/lib/dev-login";

/**
 * Dev only: /auth/dev?as=coachos signs you in and opens the hub (optionally &next=/c/wins).
 * 404s unless dev login is enabled — see lib/dev-login.ts.
 */
export async function GET(request: NextRequest) {
  if (!devLoginEnabled()) return new NextResponse("Not found", { status: 404 });

  const { searchParams, origin } = request.nextUrl;
  const user = DEV_USERS.find((u) => u.slug === searchParams.get("as"));
  if (!user) {
    const list = DEV_USERS.map((u) => `${origin}/auth/dev?as=${u.slug}   (${u.label}, ${u.note})`).join("\n");
    return new NextResponse(`Pick a user:\n\n${list}\n`, { status: 400, headers: { "content-type": "text/plain" } });
  }

  await signInAsDevUser(user.email);
  const next = searchParams.get("next") ?? "/";
  return NextResponse.redirect(`${origin}${next.startsWith("/") && !next.startsWith("//") ? next : "/"}`);
}
