import { Hash, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { requireHubAccess } from "@/lib/session";
import { APP_NAME, PROGRAMS } from "@/lib/config";
import type { Tables } from "@/lib/database.types";

type Channel = Tables<"channels">;

const GROUPS: { key: Channel["program"]; label: string; accent?: string }[] = [
  { key: null, label: "Shared" },
  { key: "coachos", label: PROGRAMS.coachos.label, accent: PROGRAMS.coachos.accent },
  { key: "alive_free", label: PROGRAMS.alive_free.label, accent: PROGRAMS.alive_free.accent },
];

// Phase 1 placeholder: lists the channels RLS lets this user see.
export default async function HubHome() {
  const { supabase, profile } = await requireHubAccess();
  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .is("archived_at", null)
    .order("position");

  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
          <h1 className="truncate text-xl font-semibold">Hi, {profile.display_name}</h1>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-11 px-3">
            Sign out
          </Button>
        </form>
      </header>

      <nav aria-label="Channels" className="bg-sidebar text-sidebar-foreground flex flex-col gap-5 rounded-2xl p-3">
        {GROUPS.map((g) => {
          const list = (channels ?? []).filter((c) => c.program === g.key);
          if (list.length === 0) return null;
          return (
            <section key={g.label}>
              <h2 className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold tracking-wide uppercase opacity-70">
                {g.accent && <span className="size-2 rounded-full" style={{ background: g.accent }} aria-hidden />}
                {g.label}
              </h2>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <span className="hover:bg-sidebar-accent flex min-h-11 items-center gap-2 rounded-lg px-2 text-[15px]">
                      {c.type === "announcement" ? (
                        <Megaphone className="size-4 opacity-70" aria-hidden />
                      ) : (
                        <Hash className="size-4 opacity-70" aria-hidden />
                      )}
                      {c.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      {profile.role !== "member" && (
        <p className="mt-4 text-sm">
          <Badge variant="secondary">Staff: {profile.role}</Badge>
        </p>
      )}
    </main>
  );
}
