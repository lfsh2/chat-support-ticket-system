"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireHubAccess } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { Constants } from "@/lib/database.types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const enums = Constants.public.Enums;

const taskFields = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Keep the title under 200 characters."),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes are limited to 5,000 characters.")
    .nullable()
    .transform((v) => v || null),
  status: z.enum(enums.task_status),
  priority: z.enum(enums.ticket_priority),
  assignee_id: z.uuid().nullable(),
  ticket_id: z.uuid().nullable(),
  due_on: z.iso.date("Pick a valid due date.").nullable(),
});
export type TaskInput = z.input<typeof taskFields>;

async function staffClient() {
  const { supabase, profile } = await requireHubAccess();
  return isStaffRole(profile.role) ? supabase : null;
}

export async function createTask(input: TaskInput): Promise<Result<{ id: string }>> {
  const parsed = taskFields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await staffClient();
  if (!supabase) return { ok: false, error: "Tasks are for the team only." };

  const { data, error } = await supabase.from("tasks").insert(parsed.data).select("id").single();
  if (error || !data) return { ok: false, error: "We couldn't add that task. Please try again." };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Result> {
  const parsed = taskFields.partial().safeParse(patch);
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return { ok: false, error: parsed.success ? "Something went wrong." : parsed.error.issues[0].message };
  }
  const supabase = await staffClient();
  if (!supabase) return { ok: false, error: "Tasks are for the team only." };

  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: "That change didn't save. Please try again." };
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  const supabase = await staffClient();
  if (!supabase) return { ok: false, error: "Tasks are for the team only." };

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete that task. Please try again." };
  refresh();
  return { ok: true };
}
