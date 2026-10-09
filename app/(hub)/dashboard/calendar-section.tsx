import { DashboardCalendar } from "@/components/calendar/dashboard-calendar";
import { isStaffRole } from "@/lib/access";
import { EVENT_SELECT, addDays, monthGrid, type CalendarEvent } from "@/lib/calendar";
import { requireHubAccess } from "@/lib/session";
import { TASK_SELECT, type TaskRow } from "@/lib/tasks";
import { dayKey, safeTimeZone, zonedToUtc } from "@/lib/time";
import { Panel } from "./overview-bits";

/** Loads one month of events (and, for the team, task due dates) for the dashboard calendar. */
export async function CalendarSection({ month }: { month: string }) {
  const { supabase, profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);
  const today = dayKey(new Date(), timeZone);
  const grid = monthGrid(month);
  const from = grid[0];
  const to = addDays(grid[grid.length - 1], 1);

  const [{ data: events }, { data: upcoming }, { data: tasks }] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_SELECT)
      .gte("starts_at", zonedToUtc(from, "00:00", timeZone).toISOString())
      .lt("starts_at", zonedToUtc(to, "00:00", timeZone).toISOString())
      .order("starts_at"),
    supabase.from("events").select(EVENT_SELECT).gte("starts_at", new Date().toISOString()).order("starts_at").limit(6),
    isStaffRole(profile.role)
      ? supabase.from("tasks").select(TASK_SELECT).gte("due_on", from).lt("due_on", to).limit(500)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <Panel title="Calendar">
      <div className="pt-3">
        <DashboardCalendar
          month={month}
          today={today}
          timeZone={timeZone}
          events={(events ?? []) as CalendarEvent[]}
          upcoming={(upcoming ?? []) as CalendarEvent[]}
          tasks={(tasks ?? []) as unknown as TaskRow[]}
        />
      </div>
    </Panel>
  );
}
