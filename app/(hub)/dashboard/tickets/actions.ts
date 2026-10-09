"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireHubAccess } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { Constants } from "@/lib/database.types";
import { friendlyTicketError } from "@/lib/tickets";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const enums = Constants.public.Enums;

const newTicket = z.object({
  program: z.enum(enums.program),
  category: z.enum(enums.ticket_category, "Pick what this is about."),
  subject: z
    .string()
    .trim()
    .min(3, "Add a short subject, like \"Domain won't verify\".")
    .max(160, "Keep the subject under 160 characters. Put the details below."),
  body: z.string().trim().min(1, "Tell us a little about what's going on.").max(10_000, "That's a lot! Trim it a bit, or attach a file."),
  blocking: z.boolean(),
});
export type NewTicketInput = z.input<typeof newTicket>;

export async function openTicket(input: NewTicketInput): Promise<Result<{ number: number }>> {
  const parsed = newTicket.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase } = await requireHubAccess();
  const { program, category, subject, body, blocking } = parsed.data;

  const { data, error } = await supabase.rpc("open_ticket", {
    p_program: program,
    p_category: category,
    p_subject: subject,
    p_body: body,
    p_priority: blocking ? "high" : "normal",
  });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: friendlyTicketError(error) };
  return { ok: true, number: row.number };
}

const ticketPatch = z
  .object({
    status: z.enum(enums.ticket_status),
    priority: z.enum(enums.ticket_priority),
    assignee_id: z.uuid().nullable(),
  })
  .partial();

/** Staff-only: status, priority and assignee. RLS enforces this too. */
export async function updateTicket(id: string, patch: z.input<typeof ticketPatch>): Promise<Result> {
  const parsed = ticketPatch.safeParse(patch);
  if (!z.uuid().safeParse(id).success || !parsed.success) return { ok: false, error: "That change didn't make sense. Please try again." };
  const { supabase, profile } = await requireHubAccess();
  if (!isStaffRole(profile.role)) return { ok: false, error: "Only the team can change tickets." };

  const { error } = await supabase.from("tickets").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: "That change didn't save. Please try again." };
  refresh();
  return { ok: true };
}

/** "Did this solve it?" from the client who opened the ticket. */
export async function rateTicket(id: string, score: 1 | -1): Promise<Result> {
  if (!z.uuid().safeParse(id).success || (score !== 1 && score !== -1)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireHubAccess();
  const { error } = await supabase.rpc("rate_ticket", { tid: id, score });
  if (error) return { ok: false, error: "We couldn't save that. Please try again." };
  refresh();
  return { ok: true };
}
