import "server-only";
import { cookies } from "next/headers";
import { createDemoClient } from "./client";
import { DEMO_COOKIE } from "./config";
import { runQuery, runRpc, store } from "./store";

export async function demoUserId(): Promise<string | null> {
  const id = (await cookies()).get(DEMO_COOKIE)?.value ?? null;
  return id && store().tables.profiles.some((p) => p.id === id) ? id : null;
}

export async function setDemoUser(id: string | null) {
  const jar = await cookies();
  if (id) jar.set(DEMO_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  else jar.delete(DEMO_COOKIE);
}

/** Server side: queries run directly against the in-memory store as the signed-in demo user. */
export function createServerDemoClient({ asAdmin = false } = {}) {
  return createDemoClient({
    query: async (q) => runQuery(q, asAdmin ? null : await demoUserId()),
    rpc: async (name, args) => runRpc(name, args, asAdmin ? null : await demoUserId()),
    userId: demoUserId,
    signOut: () => setDemoUser(null),
  });
}
