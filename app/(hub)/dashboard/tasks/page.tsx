import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/top-bar";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { TaskBoard } from "@/components/tasks/task-board";
import { isStaffRole, STAFF_ROLES } from "@/lib/access";
import { APP_NAME } from "@/lib/config";
import { requireHubAccess } from "@/lib/session";
import { TASK_SELECT, type TaskRow } from "@/lib/tasks";
import { OPEN_STATUSES } from "@/lib/tickets";
import { dayKey, safeTimeZone } from "@/lib/time";

export const metadata: Metadata = { title: `Tasks · ${APP_NAME}` };

// Team-only. Members get a 404 rather than a hint that the page exists.
export default async function TasksPage() {
  const { supabase, profile } = await requireHubAccess();
  if (!isStaffRole(profile.role)) notFound();

  const [{ data: tasks }, { data: staff }, { data: tickets }] = await Promise.all([
    supabase.from("tasks").select(TASK_SELECT).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id, display_name, avatar_url").in("role", STAFF_ROLES).order("display_name"),
    supabase
      .from("tickets")
      .select("id, number, subject")
      .in("status", OPEN_STATUSES)
      .order("number", { ascending: false })
      .limit(200),
  ]);

  return (
    <>
      <TopBar title="Tasks" subtitle="What the team is working on" />
      <DashboardNav />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TaskBoard
          tasks={(tasks ?? []) as unknown as TaskRow[]}
          staff={staff ?? []}
          tickets={tickets ?? []}
          meId={profile.id}
          today={dayKey(new Date(), safeTimeZone(profile.timezone))}
        />
      </div>
    </>
  );
}
