import type { Program } from "@/lib/access";

/** A connected mailbox (coachos@, support@, …) and the team-only channel it feeds. */
export type Mailbox = { email: string; program: Program | null; channelId: string | null };

/**
 * Which connected mailbox a ticket's emails go out from: the one its email thread came
 * through, else the one for the ticket's program, else the first one connected.
 */
export function pickMailbox(
  mailboxes: readonly Mailbox[],
  ticket: { program: Program; threadMailbox: string | null },
): Mailbox | null {
  const thread = ticket.threadMailbox?.toLowerCase();
  return (
    (thread && mailboxes.find((m) => m.email.toLowerCase() === thread)) ||
    mailboxes.find((m) => m.program === ticket.program) ||
    mailboxes[0] ||
    null
  );
}

/** The program a client's email opens a ticket in: the mailbox's, when they have it. */
export function ticketProgram(live: readonly Program[], mailboxProgram: Program | null): Program | null {
  if (live.length === 0) return null;
  if (mailboxProgram && live.includes(mailboxProgram)) return mailboxProgram;
  return live.includes("coachos") ? "coachos" : live[0];
}
