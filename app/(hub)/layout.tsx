import { HubShell } from "@/components/shell/hub-shell";
import { requireHubAccess } from "@/lib/session";

export default async function HubLayout({ children }: LayoutProps<"/">) {
  const { supabase, profile } = await requireHubAccess();
  const [{ data: channels }, { data: unread }] = await Promise.all([
    supabase
      .from("channels")
      .select("id, slug, name, description, program, type, position")
      .is("archived_at", null)
      .order("position"),
    supabase.rpc("channel_unread_counts"),
  ]);

  return (
    <HubShell
      profile={{
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
      }}
      channels={channels ?? []}
      initialUnread={Object.fromEntries((unread ?? []).map((r) => [r.channel_id, r.unread]))}
    >
      {children}
    </HubShell>
  );
}
