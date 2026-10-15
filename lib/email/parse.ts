/**
 * Pure helpers for turning a Gmail API message (format=full) into something the hub can
 * post: who sent it, what they actually wrote (without the quoted thread or signature),
 * and whether it's mail a person should see at all.
 */

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type EmailAttachmentRef = { attachmentId: string; filename: string; mimeType: string; size: number };

export type ParsedEmail = {
  gmailMessageId: string;
  gmailThreadId: string;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  fromEmail: string;
  fromName: string | null;
  to: string[];
  subject: string;
  /** What the sender wrote, quoted history and signature removed. */
  text: string;
  receivedAt: string;
  labels: string[];
  headers: Record<string, string>;
  attachments: EmailAttachmentRef[];
};

export function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

/** `"Casey Morgan" <casey@x.com>` → { name: "Casey Morgan", email: "casey@x.com" } */
export function parseAddress(raw: string | null): { name: string | null; email: string } {
  if (!raw) return { name: null, email: "" };
  const angled = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (angled) return { name: angled[1]?.trim() || null, email: angled[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

export function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((a) => parseAddress(a).email)
    .filter(Boolean);
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function walk(part: GmailPart | undefined, visit: (p: GmailPart) => void) {
  if (!part) return;
  visit(part);
  for (const p of part.parts ?? []) walk(p, visit);
}

/** Readable text from HTML mail: block tags become line breaks, the rest is dropped. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text/plain body if there is one, else the HTML body as text. */
export function bodyText(payload: GmailPart | undefined): string {
  let plain: string | null = null;
  let html: string | null = null;
  walk(payload, (p) => {
    if (p.filename || !p.body?.data) return;
    if (p.mimeType === "text/plain" && plain === null) plain = decodeBase64Url(p.body.data);
    if (p.mimeType === "text/html" && html === null) html = decodeBase64Url(p.body.data);
  });
  if (plain !== null) return (plain as string).replace(/\r\n/g, "\n");
  if (html !== null) return htmlToText(html);
  return "";
}

export function attachmentsOf(payload: GmailPart | undefined): EmailAttachmentRef[] {
  const out: EmailAttachmentRef[] = [];
  walk(payload, (p) => {
    if (p.filename && p.body?.attachmentId) {
      out.push({
        attachmentId: p.body.attachmentId,
        filename: p.filename,
        mimeType: p.mimeType ?? "application/octet-stream",
        size: p.body.size ?? 0,
      });
    }
  });
  return out;
}

const QUOTE_STARTS = [
  /^On .{0,200}wrote:\s*$/, // Gmail / Apple Mail: "On Mon, Oct 6, 2026 at 3:05 PM Jon <x> wrote:"
  /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  /^-{2,}\s*Forwarded message\s*-{2,}/i,
  /^From:\s.+$/, // Outlook header block ("From: … / Sent: … / To: …")
  /^_{10,}$/, // Outlook separator line
];

/**
 * Just the new part of a reply: cuts the quoted thread ("On … wrote:", Outlook headers,
 * "> " lines), the signature ("-- "), and "Sent from my iPhone"-style footers.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // Gmail wraps long "On … wrote:" lines in two.
    const joined = i + 1 < lines.length ? `${t} ${lines[i + 1].trim()}` : t;
    if (QUOTE_STARTS.some((re) => re.test(t)) || /^On .{0,200}wrote:\s*$/.test(joined)) break;
    if (t === "--" || line === "-- ") break;
    if (/^Sent from my (iPhone|iPad|Android|Galaxy|mobile device)/i.test(t)) break;
    if (/^Get Outlook for (iOS|Android)/i.test(t)) break;
    kept.push(line);
  }
  // Trailing "> quoted" lines left over from bottom-posting.
  while (kept.length && (kept[kept.length - 1].trim().startsWith(">") || kept[kept.length - 1].trim() === "")) kept.pop();
  return kept.join("\n").trim();
}

export function parseGmailMessage(m: GmailMessage): ParsedEmail {
  const headers = m.payload?.headers ?? [];
  const from = parseAddress(header(headers, "From"));
  const all: Record<string, string> = {};
  for (const h of headers) all[h.name.toLowerCase()] = h.value;
  return {
    gmailMessageId: m.id,
    gmailThreadId: m.threadId,
    messageIdHeader: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
    inReplyTo: header(headers, "In-Reply-To"),
    fromEmail: from.email,
    fromName: from.name,
    to: [...parseAddressList(header(headers, "To")), ...parseAddressList(header(headers, "Cc"))],
    subject: (header(headers, "Subject") ?? "").trim(),
    text: stripQuoted(bodyText(m.payload)),
    receivedAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    labels: m.labelIds ?? [],
    headers: all,
    attachments: attachmentsOf(m.payload),
  };
}

const NOISE_CATEGORIES = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"];
const ROBOT_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|notifications?|bounces?)[@+.-]/i;

/**
 * Why a message should not reach the team, or null if a person should see it.
 * Known clients skip the category check (Gmail sometimes files a client under Updates),
 * but auto-replies and bounces are always dropped.
 */
export function ignoreReason(e: Pick<ParsedEmail, "labels" | "headers" | "fromEmail">, opts: { knownClient: boolean }): string | null {
  if (e.labels.includes("SPAM") || e.labels.includes("TRASH")) return "spam or trash";
  const auto = e.headers["auto-submitted"];
  if (auto && auto.toLowerCase() !== "no") return "auto-reply";
  if (e.headers["x-autoreply"] || e.headers["x-autorespond"]) return "auto-reply";
  if (/^(mailer-daemon|postmaster)@/i.test(e.fromEmail)) return "bounce";
  if (opts.knownClient) return null;
  const precedence = e.headers["precedence"]?.toLowerCase();
  if (precedence && ["bulk", "list", "junk"].includes(precedence)) return "bulk mail";
  if (e.headers["list-unsubscribe"]) return "newsletter";
  if (ROBOT_SENDER.test(e.fromEmail)) return "automated sender";
  const category = e.labels.find((l) => NOISE_CATEGORIES.includes(l));
  if (category) return category.replace("CATEGORY_", "").toLowerCase();
  return null;
}

/** "Re: Re: FW: Domain help" → "Domain help" (for matching and ticket subjects). */
export function cleanSubject(subject: string): string {
  return subject.replace(/^\s*((re|fw|fwd|aw|sv)\s*:\s*)+/i, "").trim();
}
