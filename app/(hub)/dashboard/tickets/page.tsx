import type { Metadata } from "next";
import { TopBar } from "@/components/shell/top-bar";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { GetHelpButton } from "@/components/tickets/new-ticket-flow";
import { isStaffRole } from "@/lib/access";
import { myPrograms, requireHubAccess } from "@/lib/session";
import { APP_NAME } from "@/lib/config";
import { parseQueueView } from "@/lib/tickets";
import { MemberTickets } from "./member-tickets";
import { StaffQueue } from "./staff-queue";

export const metadata: Metadata = { title: `Tickets · ${APP_NAME}` };

export default async function TicketsPage({ searchParams }: PageProps<"/dashboard/tickets">) {
  const sp = await searchParams;
  const { profile } = await requireHubAccess();
  const programs = await myPrograms();
  const staff = isStaffRole(profile.role);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <>
      <TopBar
        title={staff ? "Tickets" : "Help"}
        subtitle={staff ? "Everything clients have asked us" : "Your conversations with the team"}
        actions={
          !staff && (
            <GetHelpButton programs={programs} autoOpen={one(sp.new) === "1"} className="mr-1 h-10 px-4 md:mr-0" />
          )
        }
      />
      <DashboardNav />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {staff ? (
          <StaffQueue
            view={parseQueueView(one(sp.view))}
            program={one(sp.program)}
            priority={one(sp.priority)}
          />
        ) : (
          <MemberTickets programs={programs} />
        )}
      </div>
    </>
  );
}
