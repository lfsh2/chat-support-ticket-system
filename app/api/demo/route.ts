import { NextResponse, type NextRequest } from "next/server";
import { DEMO_OFFLINE } from "@/lib/demo/config";
import { demoUserId } from "@/lib/demo/server";
import { eventsSince, runQuery, runRpc } from "@/lib/demo/store";
import type { DemoQuery, DemoRow } from "@/lib/demo/types";

export const dynamic = "force-dynamic";

async function guard() {
  if (!DEMO_OFFLINE) return { error: new NextResponse("Not found", { status: 404 }) };
  const userId = await demoUserId();
  if (!userId) return { error: NextResponse.json({ data: null, error: { message: "Not signed in" } }, { status: 401 }) };
  return { userId };
}

export async function POST(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = (await request.json()) as { kind: "query"; q: DemoQuery } | { kind: "rpc"; name: string; args: DemoRow };
  return NextResponse.json(body.kind === "rpc" ? runRpc(body.name, body.args ?? {}, g.userId) : runQuery(body.q, g.userId));
}

export async function GET(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  return NextResponse.json(eventsSince(Number(request.nextUrl.searchParams.get("since") ?? -1), g.userId));
}
