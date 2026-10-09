import type { Metadata } from "next";
import { TopBar } from "@/components/shell/top-bar";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { isStaffRole } from "@/lib/access";
import { APP_NAME } from "@/lib/config";
import { requireHubAccess } from "@/lib/session";
import { isMonthKey, monthOf } from "@/lib/calendar";
import { dayKey, greeting, longDate, safeTimeZone } from "@/lib/time";
import { CalendarSection } from "./calendar-section";
import { MemberOverview } from "./member-overview";
import { StaffOverview } from "./staff-overview";

export const metadata: Metadata = { title: `Dashboard · ${APP_NAME}` };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { month: monthParam } = await searchParams;
  const { profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);
  const now = new Date();
  const month = isMonthKey(monthParam) ? monthParam : monthOf(dayKey(now, timeZone));
  const firstName = profile.display_name.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || profile.display_name;

  return (
    <>
      <TopBar title="Dashboard" />
      <DashboardNav />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pt-7 pb-12 md:px-10 md:pt-10">
          <header>
            <p className="note text-muted-foreground text-[15px]">{longDate(now, timeZone)}</p>
            <h2 className="font-display mt-1 text-[32px] leading-[1.05] tracking-tight md:text-[42px]">
              {greeting(now, timeZone)}, {firstName}.
            </h2>
          </header>
          {isStaffRole(profile.role) ? <StaffOverview /> : <MemberOverview />}
          <CalendarSection month={month} />
        </div>
      </div>
    </>
  );
}
