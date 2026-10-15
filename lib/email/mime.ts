/**
 * Builds the raw RFC 2822 message Gmail's `messages.send` expects (base64url), as a
 * multipart/alternative with a plain-text and an HTML part.
 */

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  inReplyTo?: string | null;
  references?: string | null;
};

/** RFC 2047 encoding for non-ASCII header values (names, subjects). */
export function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(s: string): string {
  return (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

export function buildRawEmail(e: OutgoingEmail, boundary = `hub-${Math.random().toString(36).slice(2)}`): string {
  const headers = [
    `From: ${e.from}`,
    `To: ${e.to}`,
    `Subject: ${encodeHeader(e.subject)}`,
    "MIME-Version: 1.0",
    ...(e.inReplyTo ? [`In-Reply-To: ${e.inReplyTo}`] : []),
    ...(e.references ? [`References: ${e.references}`] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(e.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(e.html),
    `--${boundary}--`,
    "",
  ];
  const raw = [...headers, "", ...body].join("\r\n");
  return Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The hub's reply email: what the team wrote, who wrote it, and a way back into the hub. */
export function ticketEmailBodies(opts: { message: string; signedBy: string; ticketUrl: string; ticketNumber: number }) {
  const text = `${opts.message}\n\n${opts.signedBy}\nAlive + Free team\n\nReply to this email, or see the whole conversation in your Client Hub (ticket #${opts.ticketNumber}):\n${opts.ticketUrl}\n`;
  const paragraphs = opts.message
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1B2233;max-width:560px;">${paragraphs}<p style="margin:0 0 20px;color:#5B6475;">${escapeHtml(opts.signedBy)}<br>Alive + Free team</p><p style="margin:0;font-size:13px;color:#5B6475;border-top:1px solid #E4E0D5;padding-top:12px;">Reply to this email, or <a href="${escapeHtml(opts.ticketUrl)}" style="color:#131C33;font-weight:600;">open ticket #${opts.ticketNumber} in your Client Hub</a>.</p></div>`;
  return { text, html };
}
