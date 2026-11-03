/**
 * @mentions are stored in message bodies as `@[Name](user:<uuid>)` (the database turns those
 * into notifications). People typing see and edit plain `@Name`; these helpers convert
 * between the two.
 */

export type Mention = { id: string; name: string };

const STORED = /@\[([^\]\n]{1,80})\]\(user:([0-9a-f-]{36})\)/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Stored body → what the composer shows, plus the people it mentions. */
export function bodyToDraft(body: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = body.replace(STORED, (_, name: string, id: string) => {
    if (!mentions.some((m) => m.id === id)) mentions.push({ id, name });
    return `@${name}`;
  });
  return { text, mentions };
}

/** Composer text → stored body. Only `@Name`s picked from the list become mentions. */
export function draftToBody(text: string, mentions: Mention[]): string {
  // Longest names first, so "@Jon Smith" wins over "@Jon".
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
  if (sorted.length === 0) return text;
  const byName = new Map(sorted.map((m) => [m.name, m]));
  const re = new RegExp(`(^|[^\\w@\\]])@(${sorted.map((m) => escape(m.name)).join("|")})(?![\\w])`, "g");
  return text.replace(re, (_, before: string, name: string) => `${before}@[${name}](user:${byName.get(name)!.id})`);
}

/** Mention markup → `@Name` (emails, previews). */
export function stripMentions(body: string): string {
  return body.replace(STORED, "@$1");
}

/**
 * Is the caret right after an `@word` being typed? Returns where the `@` is and the text after it.
 * `@` must start the text or follow a space/bracket, so emails like a@b.com don't trigger it.
 */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[\s(])@([^\s@[\]()]{0,30})$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/** Filter people by what's been typed after `@` (word-start match, case-insensitive). */
export function matchPeople<T extends { display_name: string }>(people: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return people.slice(0, limit);
  const starts: T[] = [];
  const words: T[] = [];
  for (const p of people) {
    const name = p.display_name.toLowerCase();
    if (name.startsWith(q)) starts.push(p);
    else if (name.split(/[\s(]+/).some((w) => w.startsWith(q))) words.push(p);
  }
  return [...starts, ...words].slice(0, limit);
}
