import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TopBar } from "@/components/shell/top-bar";
import { UserAvatar } from "@/components/shell/user-avatar";
import { signOut } from "@/app/actions/auth";
import { membershipGrantsAccess } from "@/lib/access";
import { requireHubAccess } from "@/lib/session";
import { APP_NAME, PROGRAMS } from "@/lib/config";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = { title: `Me · ${APP_NAME}` };

const STATUS_LABEL = { active: "Active", manual: "Active", past_due: "Payment issue", canceled: "Ended" } as const;

export default async function MePage() {
  const { supabase, profile } = await requireHubAccess();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("program, status, grace_until")
    .eq("user_id", profile.id);

  return (
    <>
      <TopBar title="Me" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
          <section className="flex items-center gap-4">
            <UserAvatar name={profile.display_name} src={profile.avatar_url} seed={profile.id} className="size-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{profile.display_name}</p>
              <p className="text-muted-foreground truncate text-sm">{profile.email}</p>
            </div>
          </section>

          <Separator />

          <section aria-labelledby="programs-h" className="flex flex-col gap-2">
            <h2 id="programs-h" className="text-sm font-semibold">
              Your programs
            </h2>
            {(memberships ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {profile.role === "member" ? "No programs yet." : "You're on the team, so you can see every channel."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {memberships!.map((m) => (
                  <li key={m.program} className="bg-card flex min-h-12 items-center gap-3 rounded-xl border px-4">
                    <span className="size-2.5 rounded-full" style={{ background: PROGRAMS[m.program].accent }} aria-hidden />
                    <span className="flex-1 font-medium">{PROGRAMS[m.program].label}</span>
                    <Badge variant={membershipGrantsAccess(m) ? "secondary" : "outline"}>{STATUS_LABEL[m.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {/* TODO(phase 6): "Manage billing" → Stripe Customer Portal */}
          </section>

          <section aria-labelledby="theme-h" className="flex flex-col gap-2">
            <h2 id="theme-h" className="text-sm font-semibold">
              Appearance
            </h2>
            <ThemeToggle />
          </section>

          <Separator />

          <form action={signOut}>
            <Button type="submit" variant="outline" className="h-12 w-full gap-2 text-base">
              <LogOut className="size-4" aria-hidden /> Sign out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
