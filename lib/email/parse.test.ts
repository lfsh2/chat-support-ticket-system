import { describe, expect, it } from "vitest";
import { buildRawEmail, encodeHeader, ticketEmailBodies } from "./mime";
import {
  bodyText,
  cleanSubject,
  decodeBase64Url,
  htmlToText,
  ignoreReason,
  parseAddress,
  parseAddressList,
  parseGmailMessage,
  stripQuoted,
  type GmailMessage,
} from "./parse";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

describe("addresses", () => {
  it("parses names and plain addresses", () => {
    expect(parseAddress('"Casey Morgan" <Casey@Example.com>')).toEqual({ name: "Casey Morgan", email: "casey@example.com" });
    expect(parseAddress("jon@x.com")).toEqual({ name: null, email: "jon@x.com" });
    expect(parseAddressList('"Doe, Jane" <jane@x.com>, bob@y.com')).toEqual(["jane@x.com", "bob@y.com"]);
  });
});

describe("stripQuoted", () => {
  it("keeps only the new text of a Gmail reply", () => {
    const t = "Thanks, that worked!\n\nOn Mon, Oct 6, 2026 at 3:05 PM Jon <jon@x.com> wrote:\n> Try reconnecting.\n";
    expect(stripQuoted(t)).toBe("Thanks, that worked!");
  });
  it("handles Gmail's wrapped 'wrote:' line", () => {
    const t = "Perfect.\n\nOn Mon, Oct 6, 2026 at 3:05 PM Jon Dela Cruz <jonel@aliveandfreeconsulting.com>\nwrote:\n> hi";
    expect(stripQuoted(t)).toBe("Perfect.");
  });
  it("cuts Outlook headers, signatures and mobile footers", () => {
    expect(stripQuoted("See attached.\n\nFrom: Jon\nSent: Monday\nTo: Casey")).toBe("See attached.");
    expect(stripQuoted("Quick question\n-- \nCasey Morgan\nCoach")).toBe("Quick question");
    expect(stripQuoted("On my way\n\nSent from my iPhone")).toBe("On my way");
  });
  it("leaves a normal message alone", () => {
    expect(stripQuoted("Line one\n\nLine two")).toBe("Line one\n\nLine two");
  });
});

describe("bodies", () => {
  it("prefers text/plain and falls back to HTML", () => {
    const plain = { mimeType: "multipart/alternative", parts: [
      { mimeType: "text/plain", body: { data: b64("Hello plain") } },
      { mimeType: "text/html", body: { data: b64("<p>Hello html</p>") } },
    ] };
    expect(bodyText(plain)).toBe("Hello plain");
    expect(bodyText({ mimeType: "text/html", body: { data: b64("<p>Hi&nbsp;there</p><p>Line 2<br>Line 3</p>") } })).toBe("Hi there\nLine 2\nLine 3");
  });
  it("turns HTML into readable text", () => {
    expect(htmlToText("<style>x{}</style><ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two");
  });
  it("decodes base64url", () => {
    expect(decodeBase64Url(b64("héllo ✓"))).toBe("héllo ✓");
  });
});

describe("parseGmailMessage", () => {
  it("pulls out sender, subject, text and attachments", () => {
    const m: GmailMessage = {
      id: "m1",
      threadId: "t1",
      labelIds: ["INBOX", "CATEGORY_PERSONAL"],
      internalDate: String(Date.parse("2026-10-16T10:00:00Z")),
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Casey Morgan <casey@example.com>" },
          { name: "To", value: "CoachOS@AliveAndFreeConsulting.com" },
          { name: "Subject", value: "Re: Domain help" },
          { name: "Message-ID", value: "<abc@mail.gmail.com>" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: b64("Still pending.\n\nOn Tue, Jon <j@x.com> wrote:\n> ok") } },
          { mimeType: "image/png", filename: "dns.png", body: { attachmentId: "att1", size: 2048 } },
        ],
      },
    };
    const e = parseGmailMessage(m);
    expect(e.fromEmail).toBe("casey@example.com");
    expect(e.fromName).toBe("Casey Morgan");
    expect(e.to).toEqual(["coachos@aliveandfreeconsulting.com"]);
    expect(e.text).toBe("Still pending.");
    expect(e.messageIdHeader).toBe("<abc@mail.gmail.com>");
    expect(e.attachments).toEqual([{ attachmentId: "att1", filename: "dns.png", mimeType: "image/png", size: 2048 }]);
    expect(e.receivedAt).toBe("2026-10-16T10:00:00.000Z");
    expect(cleanSubject(e.subject)).toBe("Domain help");
  });
});

describe("ignoreReason", () => {
  const base = { labels: ["INBOX"], headers: {}, fromEmail: "person@example.com" };
  it("lets a person's email through", () => {
    expect(ignoreReason(base, { knownClient: false })).toBeNull();
  });
  it("drops newsletters, receipts, promotions and robots for unknown senders", () => {
    expect(ignoreReason({ ...base, headers: { "list-unsubscribe": "<mailto:x>" } }, { knownClient: false })).toBe("newsletter");
    expect(ignoreReason({ ...base, labels: ["INBOX", "CATEGORY_UPDATES"] }, { knownClient: false })).toBe("updates");
    expect(ignoreReason({ ...base, fromEmail: "no-reply@elevenlabs.io" }, { knownClient: false })).toBe("automated sender");
    expect(ignoreReason({ ...base, headers: { precedence: "bulk" } }, { knownClient: false })).toBe("bulk mail");
  });
  it("never lets auto-replies or bounces through, even from clients", () => {
    expect(ignoreReason({ ...base, headers: { "auto-submitted": "auto-replied" } }, { knownClient: true })).toBe("auto-reply");
    expect(ignoreReason({ ...base, fromEmail: "mailer-daemon@googlemail.com" }, { knownClient: true })).toBe("bounce");
  });
  it("doesn't let Gmail's categories hide a client", () => {
    expect(ignoreReason({ ...base, labels: ["INBOX", "CATEGORY_UPDATES"] }, { knownClient: true })).toBeNull();
  });
});

describe("outgoing mail", () => {
  it("builds a threaded multipart message Gmail accepts", () => {
    const raw = buildRawEmail(
      { from: "CoachOS <coachos@x.com>", to: "casey@example.com", subject: "Re: Domain ✓", text: "Hi", html: "<p>Hi</p>", inReplyTo: "<abc@x>", references: "<abc@x>" },
      "B",
    );
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("In-Reply-To: <abc@x>");
    expect(decoded).toContain(`Subject: ${encodeHeader("Re: Domain ✓")}`);
    expect(decoded).toContain('Content-Type: multipart/alternative; boundary="B"');
    expect(raw).not.toMatch(/[+/=]/);
  });
  it("escapes the team's text in the HTML body", () => {
    const { html, text } = ticketEmailBodies({ message: "Use <b> tags?\n\nYes", signedBy: "Jon", ticketUrl: "https://hub/x", ticketNumber: 1042 });
    expect(html).toContain("Use &lt;b&gt; tags?");
    expect(text).toContain("ticket #1042");
  });
});
