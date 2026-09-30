import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <div className="flex max-w-lg flex-col gap-8 px-5 py-8 md:px-10 md:py-12">
          <section className="flex items-center gap-4">
            <UserAvatar name={profile.display_name} src={profile.avatar_url} seed={profile.id} className="size-16 text-lg" />
            <div className="min-w-0">
              <p className="font-display truncate text-[28px] leading-tight tracking-tight">{profile.display_name}</p>
              <p className="text-muted-foreground truncate text-sm">{profile.email}</p>
            </div>
          </section>

          <section aria-labelledby="programs-h" className="flex flex-col">
            <h2 id="programs-h" className="note text-muted-foreground border-rule border-b pb-2 text-[15px]">
              Your programs
            </h2>
            {(memberships ?? []).length === 0 ? (
              <p className="text-muted-foreground pt-3 text-sm">
                {profile.role === "member" ? "No programs yet." : "You're on the team, so you can see every channel."}
              </p>
            ) : (
              <ul>
                {memberships!.map((m) => (
                  <li key={m.program} className="border-rule flex min-h-14 items-center gap-3 border-b">
                    <span className="h-5 w-[3px] rounded-full" style={{ background: PROGRAMS[m.program].accent }} aria-hidden />
                    <span className="flex-1 text-[15px] font-medium">{PROGRAMS[m.program].label}</span>
                    <span
                      className={
                        membershipGrantsAccess(m)
                          ? "text-success text-sm font-semibold"
                          : "text-muted-foreground text-sm font-semibold"
                      }
                    >
                      {STATUS_LABEL[m.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* TODO(phase 6): "Manage billing" → Stripe Customer Portal */}
          </section>

          <section aria-labelledby="theme-h" className="flex flex-col gap-3">
            <h2 id="theme-h" className="note text-muted-foreground border-rule border-b pb-2 text-[15px]">
              Appearance
            </h2>
            <ThemeToggle />
          </section>

          <form action={signOut} className="pt-2">
            <Button type="submit" variant="ghost" className="text-destructive hover:text-destructive h-12 cursor-pointer gap-2 px-0 text-base">
              <LogOut className="size-4" aria-hidden /> Sign out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
