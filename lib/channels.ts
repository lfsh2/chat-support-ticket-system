/** "Casey Morgan's site" → "casey-morgan-s-site", matching how channel names read. */
export function toChannelName(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/**
 * Channels other parts of the hub find by their address: the email feed, the parents that
 * private client channels nest under, and the default landing channel. They can be renamed
 * and re-described, but not archived.
 */
export const PROTECTED_CHANNEL_SLUGS: ReadonlySet<string> = new Set([
  "general",
  "announcements",
  "coachos-help",
  "community",
  "coachos-email-ticket",
]);

/** Feeds that carry client emails must never be opened up to members. */
export const ALWAYS_TEAM_ONLY_SLUGS: ReadonlySet<string> = new Set(["coachos-email-ticket"]);
