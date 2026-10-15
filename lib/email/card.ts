/** The details behind an email card in #coachos-email-ticket (messages.meta, kind 'email'). */
export type EmailCardMeta = {
  inbound_id: string;
  kind: "new_ticket" | "reply" | "unmatched";
  from_name: string | null;
  from_email: string;
  subject: string;
  preview: string;
  attachments: number;
  gmail_url: string;
  ticket_number?: number;
  handled_by?: string | null;
  handled_at?: string | null;
};

export const EMAIL_FEED_SLUG = "coachos-email-ticket";

export function gmailThreadUrl(threadId: string, inbox: string) {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(inbox)}#all/${threadId}`;
}

export function previewOf(text: string, max = 280) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
