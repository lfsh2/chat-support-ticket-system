import { createDemoClient } from "./client";
import type { DemoQuery, DemoRow } from "./types";

async function post(body: unknown) {
  const res = await fetch("/api/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  return res.json();
}

/** Browser side of the offline demo: every query goes to /api/demo on the server. */
export function createBrowserDemoClient() {
  return createDemoClient({
    query: (q: DemoQuery) => post({ kind: "query", q }),
    rpc: (name: string, args: DemoRow) => post({ kind: "rpc", name, args }),
    events: async (since) => {
      const res = await fetch(`/api/demo?since=${since ?? -1}`, { credentials: "same-origin" });
      return res.json();
    },
    userId: async () => null,
  });
}
