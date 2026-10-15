import "server-only";
import type { GmailMessage } from "@/lib/email/parse";

/**
 * The few Gmail API calls the hub needs, over plain fetch (no SDK). Scope: gmail.modify
 * (read, send, label) on the one shared CoachOS mailbox, authorised once by an admin.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = process.env.GMAIL_API_BASE ?? "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
/** Cookie holding the OAuth `state` between /api/gmail/connect and the callback. */
export const STATE_COOKIE = "gmail_oauth_state";

/** The mailbox the hub may connect to; anything else is refused at sign-in. */
export const INBOX_ADDRESS = (process.env.MAIL_INBOX_ADDRESS ?? "coachos@aliveandfreeconsulting.com").toLowerCase();

export class GmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET aren't set.");
  return { id, secret };
}

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.MAIL_TOKEN_KEY);
}

export function consentUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: clientCreds().id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", // → refresh token
    prompt: "consent", // → always issue one, even on reconnect
    include_granted_scopes: "true",
    login_hint: INBOX_ADDRESS,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new GmailError(json.error_description ?? json.error ?? "Token request failed", res.status);
  return json;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new GmailError("Google didn't return a refresh token. Remove the app's access and connect again.", 400);
  return { accessToken: t.access_token!, refreshToken: t.refresh_token };
}

export async function accessTokenFrom(refreshToken: string) {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token!;
}

export class Gmail {
  constructor(private token: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new GmailError(err.error?.message ?? `Gmail API ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
  }

  profile() {
    return this.call<{ emailAddress: string; historyId: string }>("/profile");
  }

  /** New message ids since `startHistoryId`, plus the newest history id seen. */
  async addedSince(startHistoryId: string) {
    const ids: string[] = [];
    let latest = startHistoryId;
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500" });
      if (pageToken) q.set("pageToken", pageToken);
      const page = await this.call<{
        history?: { messagesAdded?: { message: { id: string } }[] }[];
        historyId: string;
        nextPageToken?: string;
      }>(`/history?${q}`);
      for (const h of page.history ?? []) for (const a of h.messagesAdded ?? []) if (!ids.includes(a.message.id)) ids.push(a.message.id);
      latest = page.historyId ?? latest;
      pageToken = page.nextPageToken;
    } while (pageToken);
    return { ids, latest };
  }

  message(id: string) {
    return this.call<GmailMessage>(`/messages/${id}?format=full`);
  }

  async attachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const a = await this.call<{ data: string }>(`/messages/${messageId}/attachments/${attachmentId}`);
    return Buffer.from(a.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  }

  send(raw: string, threadId?: string | null) {
    return this.call<{ id: string; threadId: string }>("/messages/send", {
      method: "POST",
      body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
    });
  }
}
