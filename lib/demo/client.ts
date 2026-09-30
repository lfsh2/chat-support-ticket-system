import type { DemoEvent, DemoFilter, DemoQuery, DemoResult, DemoRow } from "./types";

/**
 * A Supabase-shaped client for the offline demo. Implements only what the app calls:
 * from().select/insert/update/delete + eq/is/lt/like/match/order/limit/single/maybeSingle,
 * rpc(), channel().on().subscribe() (polled), removeChannel(), storage and auth basics.
 */
export type DemoTransport = {
  query: (q: DemoQuery) => Promise<DemoResult>;
  rpc: (name: string, args: DemoRow) => Promise<DemoResult>;
  events?: (since: number | null) => Promise<{ seq: number; events: DemoEvent[] }>;
  userId: () => Promise<string | null>;
  signOut?: () => Promise<void>;
};

class QueryBuilder implements PromiseLike<DemoResult> {
  private q: DemoQuery;
  constructor(
    private transport: DemoTransport,
    table: string,
  ) {
    this.q = { table, action: "select", filters: [] };
  }
  select(columns = "*", opts?: { head?: boolean; count?: string }) {
    if (this.q.action === "select") this.q.select = columns;
    else this.q.select = columns; // insert(...).select() returns rows
    if (opts?.head) this.q.head = true;
    return this;
  }
  insert(values: DemoRow | DemoRow[]) {
    this.q.action = "insert";
    this.q.values = values;
    this.q.select = undefined;
    return this;
  }
  update(values: DemoRow) {
    this.q.action = "update";
    this.q.values = values;
    return this;
  }
  delete() {
    this.q.action = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.q.filters.push({ op: "eq", col, val });
    return this;
  }
  is(col: string, val: null) {
    this.q.filters.push({ op: "is", col, val });
    return this;
  }
  lt(col: string, val: unknown) {
    this.q.filters.push({ op: "lt", col, val });
    return this;
  }
  like(col: string, val: string) {
    this.q.filters.push({ op: "like", col, val } as DemoFilter);
    return this;
  }
  match(obj: DemoRow) {
    for (const [col, val] of Object.entries(obj)) this.eq(col, val);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.q.order = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.q.limit = n;
    return this;
  }
  single() {
    this.q.single = "single";
    return this;
  }
  maybeSingle() {
    this.q.single = "maybe";
    return this;
  }
  then<A = DemoResult, B = never>(
    onfulfilled?: ((value: DemoResult) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.transport
      .query(this.q)
      .catch((e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : "Demo request failed" } }))
      .then(onfulfilled, onrejected);
  }
}

type Listener = { table: string; event: string; filter?: { col: string; val: string }; cb: (payload: { new: DemoRow; old: DemoRow }) => void };

class DemoChannel {
  private listeners: Listener[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private since: number | null = null;
  private stopped = false;
  constructor(private transport: DemoTransport) {}

  on(_type: string, opts: { event: string; table: string; filter?: string }, cb: Listener["cb"]) {
    const m = opts.filter?.match(/^(\w+)=eq\.(.+)$/);
    this.listeners.push({ table: opts.table, event: opts.event, filter: m ? { col: m[1], val: m[2] } : undefined, cb });
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    const poll = async () => {
      if (this.stopped || !this.transport.events) return;
      try {
        const { seq, events } = await this.transport.events(this.since);
        if (this.since !== null) for (const e of events) this.dispatch(e);
        this.since = seq;
      } catch {
        // offline for a moment — try again next tick
      }
    };
    void poll().then(() => cb?.("SUBSCRIBED"));
    this.timer = setInterval(poll, 2000);
    return this;
  }

  private dispatch(e: DemoEvent) {
    for (const l of this.listeners) {
      if (l.table !== e.table || (l.event !== "*" && l.event !== e.type)) continue;
      const row = e.type === "DELETE" ? e.old : e.new;
      if (l.filter && String(row[l.filter.col]) !== l.filter.val) continue;
      l.cb({ new: e.new, old: e.old });
    }
  }

  unsubscribe() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
}

// Attachments stay in this browser's memory in the demo.
const localFiles = new Map<string, string>();

export function createDemoClient(transport: DemoTransport) {
  return {
    from: (table: string) => new QueryBuilder(transport, table),
    rpc: (name: string, args: DemoRow = {}) => {
      const p = transport.rpc(name, args);
      return { then: p.then.bind(p) };
    },
    channel: () => new DemoChannel(transport),
    removeChannel: (ch: DemoChannel) => {
      ch.unsubscribe();
      return Promise.resolve("ok");
    },
    storage: {
      from: () => ({
        upload: async (path: string, file: Blob) => {
          localFiles.set(path, URL.createObjectURL(file));
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) =>
          localFiles.has(path)
            ? { data: { signedUrl: localFiles.get(path)! }, error: null }
            : { data: null, error: { message: "Attachment previews are only kept in the browser that uploaded them during the demo." } },
      }),
    },
    auth: {
      getClaims: async () => {
        const sub = await transport.userId();
        return { data: sub ? { claims: { sub } } : null, error: null };
      },
      signOut: async () => {
        await transport.signOut?.();
        return { error: null };
      },
    },
  };
}
