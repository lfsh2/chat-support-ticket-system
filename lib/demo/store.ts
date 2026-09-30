import "server-only";
import { buildFixtures, type DemoTables } from "./fixtures";
import type { DemoEvent, DemoFilter, DemoQuery, DemoResult, DemoRow } from "./types";

/**
 * In-memory stand-in for the database used by the offline demo. Mirrors the rules that
 * RLS enforces in Postgres (program visibility, announcement posting, own-row edits),
 * and keeps a change log that browsers poll to get "realtime" updates.
 */
type Store = { tables: DemoTables; events: DemoEvent[]; seq: number };

const g = globalThis as unknown as { __hubDemoStore?: Store };

export function store(): Store {
  if (!g.__hubDemoStore) g.__hubDemoStore = { tables: buildFixtures(), events: [], seq: 0 };
  return g.__hubDemoStore;
}

type Tables = DemoTables;
const tbl = (name: string) => (store().tables as unknown as Record<string, DemoRow[]>)[name];

// ---- access rules --------------------------------------------------------------

function profileOf(userId: string | null) {
  return userId ? store().tables.profiles.find((p) => p.id === userId) : undefined;
}
export function isStaff(userId: string | null) {
  const role = profileOf(userId)?.role;
  return role === "agent" || role === "admin" || role === "owner";
}
function liveMembership(m: Tables["memberships"][number]) {
  return m.status === "active" || m.status === "manual" || (m.grace_until != null && new Date(m.grace_until) > new Date());
}
function hasProgram(userId: string | null, program: string) {
  return store().tables.memberships.some((m) => m.user_id === userId && m.program === program && liveMembership(m));
}
export function hasAnyAccess(userId: string | null) {
  return isStaff(userId) || store().tables.memberships.some((m) => m.user_id === userId && liveMembership(m));
}
function canSeeChannel(userId: string | null, channelId: unknown) {
  if (userId === null) return true; // admin client
  const c = store().tables.channels.find((x) => x.id === channelId);
  if (!c) return false;
  if (isStaff(userId)) return true;
  if (c.archived_at) return false;
  return c.program === null ? hasAnyAccess(userId) : hasProgram(userId, c.program);
}
function canSeeMessage(userId: string | null, messageId: unknown) {
  const m = store().tables.messages.find((x) => x.id === messageId);
  return Boolean(m && canSeeChannel(userId, m.channel_id));
}

function visible(table: string, row: DemoRow, userId: string | null): boolean {
  if (userId === null) return true;
  switch (table) {
    case "channels":
      return canSeeChannel(userId, row.id);
    case "messages":
      return canSeeChannel(userId, row.channel_id);
    case "reactions":
      return canSeeMessage(userId, row.message_id);
    case "profiles":
      return row.id === userId || hasAnyAccess(userId);
    case "memberships":
      return row.user_id === userId || isStaff(userId);
    case "read_states":
      return row.user_id === userId;
    default:
      return false;
  }
}

// ---- query execution -------------------------------------------------------------

function matches(row: DemoRow, f: DemoFilter) {
  const v = row[f.col];
  switch (f.op) {
    case "eq":
      return v === f.val;
    case "is":
      return v === null || v === undefined;
    case "lt":
      return String(v) < String(f.val);
    case "like": {
      const re = new RegExp(`^${f.val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i");
      return re.test(String(v ?? ""));
    }
  }
}

/** Applies select projection, including the message author/reactions joins the app uses. */
function project(table: string, row: DemoRow, select: string | undefined, userId: string | null): DemoRow {
  const sel = (select ?? "*").replace(/\s+/g, " ");
  let out: DemoRow = { ...row };
  const plain = sel
    .replace(/\w+:\w+!?[\w]*\([^)]*\)/g, "")
    .replace(/\w+\([^)]*\)/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!plain.includes("*")) out = Object.fromEntries(plain.map((c) => [c, row[c]]));

  if (table === "messages" && sel.includes("author:")) {
    const p = store().tables.profiles.find((x) => x.id === row.author_id);
    out.author = p ? { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, role: p.role } : null;
  }
  if (table === "messages" && /reactions\(/.test(sel)) {
    out.reactions = store()
      .tables.reactions.filter((r) => r.message_id === row.id && visible("reactions", r, userId))
      .map((r) => ({ emoji: r.emoji, user_id: r.user_id }));
  }
  return out;
}

function record(table: string, type: DemoEvent["type"], next: DemoRow, prev: DemoRow) {
  const s = store();
  s.events.push({ seq: ++s.seq, table, type, new: { ...next }, old: { ...prev } });
  if (s.events.length > 2000) s.events.splice(0, s.events.length - 2000);
}

const fail = (message: string, code = "42501"): DemoResult => ({ data: null, error: { message, code } });

function withDefaults(table: string, row: DemoRow): DemoRow {
  const now = new Date().toISOString();
  if (table === "messages")
    return {
      id: crypto.randomUUID(),
      channel_id: null,
      ticket_id: null,
      parent_id: null,
      kind: "user",
      attachments: [],
      via: "web",
      reply_count: 0,
      edited_at: null,
      deleted_at: null,
      created_at: now,
      ...row,
    };
  return { ...row };
}

function canInsert(table: string, row: DemoRow, userId: string | null): string | null {
  if (userId === null) return null;
  if (table === "messages") {
    if (row.author_id !== userId) return "You can only post as yourself.";
    if (!canSeeChannel(userId, row.channel_id)) return "Channel not visible.";
    const c = store().tables.channels.find((x) => x.id === row.channel_id);
    if (c?.type === "announcement" && !isStaff(userId) && !row.parent_id) return "Only the team posts here.";
    return null;
  }
  if (table === "reactions") return row.user_id === userId && canSeeMessage(userId, row.message_id) ? null : "Not allowed.";
  return "Not allowed in the demo.";
}

export function runQuery(q: DemoQuery, userId: string | null): DemoResult {
  const rows = tbl(q.table);
  if (!rows) return fail(`Unknown table ${q.table}`, "42P01");
  const hit = (r: DemoRow) => q.filters.every((f) => matches(r, f)) && visible(q.table, r, userId);

  if (q.action === "insert") {
    const list = (Array.isArray(q.values) ? q.values : [q.values ?? {}]).map((v) => withDefaults(q.table, v));
    for (const row of list) {
      const denied = canInsert(q.table, row, userId);
      if (denied) return fail(denied);
      if (q.table === "reactions" && rows.some((r) => r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji))
        return fail("duplicate", "23505");
    }
    for (const row of list) {
      rows.push(row);
      record(q.table, "INSERT", row, {});
      if (q.table === "messages" && row.parent_id) {
        const parent = rows.find((r) => r.id === row.parent_id);
        if (parent) {
          const before = { ...parent };
          parent.reply_count = Number(parent.reply_count ?? 0) + 1;
          record("messages", "UPDATE", parent, before);
        }
      }
    }
    const data = q.select !== undefined ? list.map((r) => project(q.table, r, q.select, userId)) : null;
    return { data: q.single ? (data?.[0] ?? null) : data, error: null };
  }

  if (q.action === "update") {
    const targets = rows.filter(hit);
    for (const row of targets) {
      if (userId !== null && q.table === "messages" && row.author_id !== userId && !isStaff(userId)) return fail("Not your message.");
      const before = { ...row };
      const values = q.values as DemoRow;
      if (q.table === "messages") {
        if (row.deleted_at) continue; // deletes are final
        if (values.deleted_at) Object.assign(row, { deleted_at: values.deleted_at, body: "", attachments: [] });
        if (typeof values.body === "string" && values.body !== row.body) Object.assign(row, { body: values.body, edited_at: new Date().toISOString() });
      } else Object.assign(row, values);
      record(q.table, "UPDATE", row, before);
    }
    return { data: null, error: null };
  }

  if (q.action === "delete") {
    const targets = rows.filter(hit);
    for (const row of targets) {
      if (userId !== null && q.table === "reactions" && row.user_id !== userId) return fail("Not your reaction.");
      rows.splice(rows.indexOf(row), 1);
      record(q.table, "DELETE", {}, row);
    }
    return { data: null, error: null };
  }

  // select
  let found = rows.filter(hit);
  if (q.order) {
    const { col, ascending } = q.order;
    found = [...found].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (ascending ? 1 : -1));
  }
  const count = found.length;
  if (q.limit !== undefined) found = found.slice(0, q.limit);
  if (q.head) return { data: null, error: null, count };
  const data = found.map((r) => project(q.table, r, q.select, userId));
  if (q.single === "single") return data.length === 1 ? { data: data[0], error: null } : fail("Row not found", "PGRST116");
  if (q.single === "maybe") return { data: data[0] ?? null, error: null };
  return { data, error: null, count };
}

export function runRpc(name: string, args: DemoRow, userId: string | null): DemoResult {
  const t = store().tables;
  switch (name) {
    case "has_any_access":
      return { data: hasAnyAccess(userId), error: null };
    case "is_staff":
      return { data: isStaff(userId), error: null };
    case "mark_channel_read": {
      if (!canSeeChannel(userId, args.cid)) return fail("channel not visible");
      const existing = t.read_states.find((r) => r.user_id === userId && r.channel_id === args.cid);
      const now = new Date().toISOString();
      if (existing) existing.last_read_at = now;
      else t.read_states.push({ user_id: userId!, channel_id: String(args.cid), ticket_id: null, last_read_at: now });
      return { data: null, error: null };
    }
    case "channel_unread_counts":
      return {
        data: t.channels
          .filter((c) => !c.archived_at && canSeeChannel(userId, c.id))
          .map((c) => {
            const since = t.read_states.find((r) => r.user_id === userId && r.channel_id === c.id)?.last_read_at ?? "";
            const unread = t.messages.filter(
              (m) => m.channel_id === c.id && !m.parent_id && !m.deleted_at && m.author_id !== userId && String(m.created_at) > since,
            ).length;
            return { channel_id: c.id, unread };
          }),
        error: null,
      };
    default:
      return fail(`Unknown function ${name}`, "42883");
  }
}

/** Change log for polling "realtime", filtered to what this user may see. */
export function eventsSince(since: number, userId: string | null): { seq: number; events: DemoEvent[] } {
  const s = store();
  const events = s.events.filter((e) => {
    if (e.seq <= since) return false;
    const row = e.type === "DELETE" ? e.old : e.new;
    if (e.table === "messages") return canSeeChannel(userId, row.channel_id);
    if (e.table === "reactions") return canSeeMessage(userId, row.message_id) || e.type === "DELETE";
    return false;
  });
  return { seq: s.seq, events };
}

export function demoUserByEmail(email: string) {
  return store().tables.profiles.find((p) => p.email === email.toLowerCase());
}
export function demoMemberships(email: string) {
  return store().tables.memberships.filter((m) => m.email === email.toLowerCase());
}
