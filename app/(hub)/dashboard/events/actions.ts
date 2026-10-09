"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireHubAccess } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { Constants } from "@/lib/database.types";
import { safeTimeZone, zonedToUtc } from "@/lib/time";

type Result = { ok: true } | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Times are wall-clock in the editor's profile timezone; we store real instants. */
const eventFields = z
  .object({
    title: z.string().trim().min(1, "Give the event a name.").max(120, "Keep the name under 120 characters."),
    description: z
      .string()
      .trim()
      .max(2000, "Keep the description under 2,000 characters.")
      .nullable()
      .transform((v) => v || null),
    program: z.enum(Constants.public.Enums.program).nullable(),
    day: z.iso.date("Pick a date."),
    start: z.string().regex(TIME, "Pick a start time."),
    end: z
      .string()
      .regex(TIME, "Pick a valid end time.")
      .nullable()
      .or(z.literal("").transform(() => null)),
    link: z
      .string()
      .trim()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Links need to start with https://"),
  })
  .refine((e) => !e.end || e.end > e.start, { message: "The end time needs to be after the start.", path: ["end"] });
export type EventInput = z.input<typeof eventFields>;

async function staffContext() {
  const { supabase, profile } = await requireHubAccess();
  return isStaffRole(profile.role) ? { supabase, timeZone: safeTimeZone(profile.timezone) } : null;
}

function toRow(e: z.output<typeof eventFields>, timeZone: string) {
  return {
    title: e.title,
    description: e.description,
    program: e.program,
    link: e.link,
    starts_at: zonedToUtc(e.day, e.start, timeZone).toISOString(),
    ends_at: e.end ? zonedToUtc(e.day, e.end, timeZone).toISOString() : null,
  };
}

export async function createEvent(input: EventInput): Promise<Result> {
  const parsed = eventFields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await staffContext();
  if (!ctx) return { ok: false, error: "Only the team can add events." };

  const { error } = await ctx.supabase.from("events").insert(toRow(parsed.data, ctx.timeZone));
  if (error) return { ok: false, error: "We couldn't add that event. Please try again." };
  refresh();
  return { ok: true };
}

export async function updateEvent(id: string, input: EventInput): Promise<Result> {
  const parsed = eventFields.safeParse(input);
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await staffContext();
  if (!ctx) return { ok: false, error: "Only the team can edit events." };

  const { error } = await ctx.supabase.from("events").update(toRow(parsed.data, ctx.timeZone)).eq("id", id);
  if (error) return { ok: false, error: "That change didn't save. Please try again." };
  refresh();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  const ctx = await staffContext();
  if (!ctx) return { ok: false, error: "Only the team can delete events." };

  const { error } = await ctx.supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete that event. Please try again." };
  refresh();
  return { ok: true };
}
