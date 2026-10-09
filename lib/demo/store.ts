import "server-only";
import { buildFixtures, type DemoTables } from "./fixtures";
import type { DemoEvent, DemoFilter, DemoQuery, DemoResult, DemoRow } from "./types";

/**
 * In-memory stand-in for the database used by the offline demo. Mirrors the rules that
 * RLS enforces in Postgres (program visibility, announcement posting, own-row edits,
 * ticket privacy, staff-only tasks and notes) and the triggers the app relies on, and
 * keeps a change log that browsers poll to get "realtime" updates.
 */
type Store = { tables: DemoTables; events: DemoEvent[]; seq: number };

const g = globalThis as unknown as { __hubDemoStore?: Store };

export function store(): Store {
  if (!g.__hubDemoStore) g.__hubDemoStore = { tables: buildFixtures(), events: [], seq: 0 };
  // Older in-memory stores (from before tickets existed) get the new tables on first use.
  const t = g.__hubDemoStore.tables;
  if (!t.tickets || !t.tasks) {
    const fresh = buildFixtures();
    t.tickets = fresh.tickets;
    t.tasks = fresh.tasks;
    t.messages.push(...fresh.messages.filter((m) => m.ticket_id));
  }
  if (!t.events) t.events = buildFixtures().events;
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
function canSeeTicket(userId: string | null, ticketId: unknown) {
  if (userId === null || isStaff(userId)) return true;
  return store().tables.tickets.some((t) => t.id === ticketId && t.requester_id === userId);
}
function canSeeMessageRow(userId: string | null, m: DemoRow) {
  if (m.channel_id) return canSeeChannel(userId, m.channel_id);
  return canSeeTicket(userId, m.ticket_id) && (m.kind !== "internal_note" || userId === null || isStaff(userId));
}
function canSeeMessage(userId: string | null, messageId: unknown) {
  const m = store().tables.messages.find((x) => x.id === messageId);
  return Boolean(m && canSeeMessageRow(userId, m));
}

function visible(table: string, row: DemoRow, userId: string | null): boolean {
  if (userId === null) return true;
  switch (table) {
    case "channels":
      return canSeeChannel(userId, row.id);
    case "messages":
      return canSeeMessageRow(userId, row);
    case "reactions":
      return canSeeMessage(userId, row.message_id);
    case "profiles":
      return row.id === userId || hasAnyAccess(userId);
    case "memberships":
      return row.user_id === userId || isStaff(userId);
    case "read_states":
      return row.user_id === userId;
    case "tickets":
      return canSeeTicket(userId, row.id);
    case "tasks":
      return isStaff(userId);
    case "events":
      return isStaff(userId) || (row.program === null ? hasAnyAccess(userId) : hasProgram(userId, String(row.program)));
    default:
      return false;
  }
}

// ---- query execution -------------------------------------------------------------

function matches(row: DemoRow, f: DemoFilter) {
  const v = row[f.col];
  switch (f.op) {
    case "eq":
      return v === f.val || (typeof v === "number" && String(v) === String(f.val));
    case "is":
      return v === null || v === undefined;
    case "lt":
      return String(v) < String(f.val);
    case "gte":
      return String(v) >= String(f.val);
    case "in":
      return f.val.some((x) => x === v);
    case "like": {
      const re = new RegExp(`^${f.val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i");
      return re.test(String(v ?? ""));
    }
  }
}

const EMBED = /(\w+):(\w+)!(\w+)\(([^)]*)\)/g;

/**
 * Applies select projection: plain columns, to-one embeds written with an explicit FK
 * hint (`author:profiles!messages_author_id_fkey(id, display_name)`), and the
 * message → reactions list.
 */
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

  for (const [, alias, target, fk, cols] of sel.matchAll(EMBED)) {
    const col = fk.replace(new RegExp(`^${table}_`), "").replace(/_fkey$/, "");
    const hit = tbl(target)?.find((r) => r.id === row[col]);
    const wanted = cols.split(",").map((c) => c.trim()).filter(Boolean);
    out[alias] = hit && visible(target, hit, userId) ? Object.fromEntries(wanted.map((c) => [c, hit[c]])) : null;
  }
  if (table === "messages" && /(^|[ ,])reactions\(/.test(sel)) {
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

const fail = (message: string, code = "42501", hint?: string): DemoResult => ({ data: null, error: { message, code, hint } });

function withDefaults(table: string, row: DemoRow, userId: string | null): DemoRow {
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
  if (table === "events")
    return { id: crypto.randomUUID(), description: null, program: null, ends_at: null, link: null, created_by: userId, created_at: now, ...row };
  if (table === "tasks")
    return {
      id: crypto.randomUUID(),
      notes: null,
      status: "todo",
      priority: "normal",
      assignee_id: null,
      created_by: userId,
      ticket_id: null,
      due_on: null,
      completed_at: row.status === "done" ? now : null,
      created_at: now,
      updated_at: now,
      ...row,
    };
  return { ...row };
}

function canInsert(table: string, row: DemoRow, userId: string | null): string | null {
  if (userId === null) return null;
  if (table === "messages") {
    if (row.author_id !== userId) return "You can only post as yourself.";
    if (row.ticket_id) {
      if (!canSeeTicket(userId, row.ticket_id)) return "Ticket not visible.";
      if (row.kind === "internal_note") return isStaff(userId) ? null : "Only the team can add notes.";
      if (row.kind !== "user") return "Not allowed.";
      const t = store().tables.tickets.find((x) => x.id === row.ticket_id);
      return t?.status === "closed" && !isStaff(userId) ? "This ticket is closed." : null;
    }
    if (row.kind !== "user") return "Not allowed.";
    if (!canSeeChannel(userId, row.channel_id)) return "Channel not visible.";
    const c = store().tables.channels.find((x) => x.id === row.channel_id);
    if (c?.type === "announcement" && !isStaff(userId) && !row.parent_id) return "Only the team posts here.";
    return null;
  }
  if (table === "reactions") return row.user_id === userId && canSeeMessage(userId, row.message_id) ? null : "Not allowed.";
  if (table === "events") return isStaff(userId) ? null : "Only the team can add events.";
  if (table === "tasks") {
    if (!isStaff(userId)) return "Not allowed.";
    const title = String(row.title ?? "").trim();
    return title.length >= 1 && title.length <= 200 ? null : "A task needs a title (up to 200 characters).";
  }
  return "Not allowed in the demo.";
}

// ---- trigger stand-ins -------------------------------------------------------------

const STATUS_EVENT: Record<string, string> = {
  waiting_on_client: "is waiting on a reply from the client",
  resolved: "marked this resolved",
  closed: "closed this ticket",
  new: "changed the status to new",
};

function systemEvent(ticketId: string, actorId: string | null, body: string) {
  const row = withDefaults("messages", { ticket_id: ticketId, author_id: actorId, kind: "system", body }, actorId);
  store().tables.messages.push(row as Tables["messages"][number]);
  record("messages", "INSERT", row, {});
}

/** tickets_status_stamps + ticket_system_events. */
function applyTicketUpdate(row: Tables["tickets"][number], values: DemoRow, actorId: string | null) {
  const before = { ...row };
  for (const key of ["status", "priority", "assignee_id", "subject", "category", "satisfaction"] as const) {
    if (key in values) (row as DemoRow)[key] = values[key];
  }
  const now = new Date().toISOString();
  row.updated_at = now;
  if (row.status !== before.status) {
    const done = (s: string) => s === "resolved" || s === "closed";
    if (done(row.status) && !done(before.status)) row.resolved_at = now;
    else if (!done(row.status)) {
      row.resolved_at = null;
      row.satisfaction = null;
    }
  }
  record("tickets", "UPDATE", row, before);

  if (row.assignee_id !== before.assignee_id) {
    const name = store().tables.profiles.find((p) => p.id === row.assignee_id)?.display_name;
    systemEvent(
      row.id,
      actorId,
      row.assignee_id === null
        ? "unassigned this ticket"
        : row.assignee_id === actorId
          ? "picked up this ticket"
          : `assigned this ticket to ${name ?? "a teammate"}`,
    );
  }
  if (row.status !== before.status) {
    const reopened = before.status === "resolved" || before.status === "closed";
    systemEvent(row.id, actorId, row.status === "open" ? (reopened ? "reopened this ticket" : "marked this open") : STATUS_EVENT[row.status]);
  }
  if (row.priority !== before.priority) systemEvent(row.id, actorId, `set the priority to ${row.priority}`);
}

/** touch_ticket + ticket_status_on_reply. */
function afterTicketMessage(msg: DemoRow) {
  const t = store().tables.tickets.find((x) => x.id === msg.ticket_id);
  if (!t) return;
  const authorIsStaff = isStaff(msg.author_id as string);
  const before = { ...t };
  t.updated_at = new Date().toISOString();
  if (!t.first_response_at && msg.kind === "user" && authorIsStaff) t.first_response_at = t.updated_at;
  record("tickets", "UPDATE", t, before);

  if (msg.kind !== "user") return;
  if (msg.author_id === t.requester_id && (t.status === "waiting_on_client" || t.status === "resolved"))
    applyTicketUpdate(t, { status: "open" }, msg.author_id as string);
  else if (authorIsStaff && t.status === "new") applyTicketUpdate(t, { status: "open" }, msg.author_id as string);
}

function stampTask(row: Tables["tasks"][number], before: Tables["tasks"][number] | null) {
  row.updated_at = new Date().toISOString();
  if (row.status === "done" && (!before || before.status !== "done")) row.completed_at = row.updated_at;
  else if (row.status !== "done") row.completed_at = null;
}

export function runQuery(q: DemoQuery, userId: string | null): DemoResult {
  const rows = tbl(q.table);
  if (!rows) return fail(`Unknown table ${q.table}`, "42P01");
  const hit = (r: DemoRow) => q.filters.every((f) => matches(r, f)) && visible(q.table, r, userId);

  if (q.action === "insert") {
    const list = (Array.isArray(q.values) ? q.values : [q.values ?? {}]).map((v) => withDefaults(q.table, v, userId));
    for (const row of list) {
      const denied = canInsert(q.table, row, userId);
      if (denied) return fail(denied);
      if (q.table === "reactions" && rows.some((r) => r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji))
        return fail("duplicate", "23505");
    }
    for (const row of list) {
      if (q.table === "tasks") stampTask(row as Tables["tasks"][number], null);
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
      if (q.table === "messages" && row.ticket_id) afterTicketMessage(row);
    }
    const data = q.select !== undefined ? list.map((r) => project(q.table, r, q.select, userId)) : null;
    return { data: q.single ? (data?.[0] ?? null) : data, error: null };
  }

  if (q.action === "update") {
    const targets = rows.filter(hit);
    if ((q.table === "tickets" || q.table === "tasks" || q.table === "events") && userId !== null && !isStaff(userId))
      return fail("Only the team can change this.");
    for (const row of targets) {
      if (userId !== null && q.table === "messages" && row.author_id !== userId && !isStaff(userId)) return fail("Not your message.");
      const values = q.values as DemoRow;
      if (q.table === "tickets") {
        applyTicketUpdate(row as Tables["tickets"][number], values, userId);
        continue;
      }
      const before = { ...row };
      if (q.table === "messages") {
        if (row.deleted_at) continue; // deletes are final
        if (values.deleted_at) Object.assign(row, { deleted_at: values.deleted_at, body: "", attachments: [] });
        if (typeof values.body === "string" && values.body !== row.body) Object.assign(row, { body: values.body, edited_at: new Date().toISOString() });
      } else if (q.table === "tasks") {
        const rest = { ...values };
        for (const locked of ["id", "created_at", "created_by"]) delete rest[locked];
        Object.assign(row, rest);
        stampTask(row as Tables["tasks"][number], before as Tables["tasks"][number]);
      } else Object.assign(row, values);
      record(q.table, "UPDATE", row, before);
    }
    const data = q.select !== undefined ? targets.map((r) => project(q.table, r, q.select, userId)) : null;
    return { data: q.single ? (data?.[0] ?? null) : data, error: null };
  }

  if (q.action === "delete") {
    const targets = rows.filter(hit);
    for (const row of targets) {
      if (userId !== null && q.table === "reactions" && row.user_id !== userId) return fail("Not your reaction.");
      if (userId !== null && (q.table === "tasks" || q.table === "events") && !isStaff(userId)) return fail("Not allowed.");
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
    case "open_ticket": {
      if (!userId) return fail("Not signed in");
      const program = args.p_program as Tables["tickets"][number]["program"];
      if (!isStaff(userId) && !hasProgram(userId, program)) return fail("new row violates row-level security policy");
      const subject = String(args.p_subject ?? "").trim();
      if (subject.length < 3 || subject.length > 160) return fail("subject length", "23514");
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      if (t.tickets.filter((x) => x.requester_id === userId && String(x.created_at) > hourAgo).length >= 5)
        return fail(
          "You've opened a few tickets in the last hour. Add details to an open ticket, or try again a little later.",
          "P0001",
          "rate_limited",
        );
      const now = new Date().toISOString();
      const row: Tables["tickets"][number] = {
        id: crypto.randomUUID(),
        number: Math.max(1000, ...t.tickets.map((x) => x.number)) + 1,
        requester_id: userId,
        program,
        category: args.p_category as Tables["tickets"][number]["category"],
        priority: (args.p_priority as Tables["tickets"][number]["priority"]) ?? "normal",
        status: "new",
        subject,
        assignee_id: null,
        first_response_at: null,
        resolved_at: null,
        satisfaction: null,
        created_at: now,
        updated_at: now,
      };
      t.tickets.push(row);
      record("tickets", "INSERT", row, {});
      const first = withDefaults("messages", { ticket_id: row.id, author_id: userId, body: String(args.p_body ?? "").trim() }, userId);
      t.messages.push(first as Tables["messages"][number]);
      record("messages", "INSERT", first, {});
      return { data: [{ id: row.id, number: row.number }], error: null };
    }
    case "rate_ticket": {
      const row = t.tickets.find((x) => x.id === args.tid && x.requester_id === userId && (x.status === "resolved" || x.status === "closed"));
      if (!row || (args.score !== 1 && args.score !== -1)) return fail("ticket not found");
      const before = { ...row };
      row.satisfaction = args.score as number;
      record("tickets", "UPDATE", row, before);
      return { data: null, error: null };
    }
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
    if (e.table === "messages") return canSeeMessageRow(userId, row);
    if (e.table === "reactions") return canSeeMessage(userId, row.message_id) || e.type === "DELETE";
    if (e.table === "tickets") return canSeeTicket(userId, row.id);
    if (e.table === "tasks") return isStaff(userId);
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
