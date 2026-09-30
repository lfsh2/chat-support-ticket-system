import { requireHubAccess } from "@/lib/session";

// Phase 2 replaces this with the full shell (Sidebar / TopBar + BottomTabs).
export default async function HubLayout({ children }: LayoutProps<"/">) {
  await requireHubAccess();
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
