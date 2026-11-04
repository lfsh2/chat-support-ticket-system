"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHub } from "@/components/shell/hub-context";
import { syncMailNow } from "@/app/(hub)/c/actions";
import { createClient } from "@/lib/supabase/client";
import { formatAge, safeTimeZone } from "@/lib/time";

type Connection = {
  email: string;
  channel_id: string | null;
  connected_at: string;
  last_synced_at: string | null;
  last_error: string | null;
};

const RETURN_MESSAGES: Record<string, [ok: boolean, text: string]> = {
  connected: [true, "Mailbox connected. New emails will appear here within a minute."],
  in_use: [false, "That Google account is already connected to another channel."],
  not_team_only: [false, "Mailboxes can only be connected to team-only channels."],
  cancelled: [false, "Connecting was cancelled. Nothing changed."],
  expired: [false, "That took too long. Please try connecting again."],
  forbidden: [false, "Only admins can connect a mailbox."],
  not_configured: [false, "Gmail isn't set up on the server yet (Google client ID and secret)."],
  error: [false, "Google didn't let us connect. Please try again."],
};

/** Every connected mailbox (staff only; never the token). */
export function useMailboxes(enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["mailbox-status"],
    enabled,
    queryFn: async (): Promise<Connection[]> => {
      const { data, error } = await supabase.rpc("mail_connection_status");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

/**
 * The strip at the top of a team-only channel: which mailbox feeds it, when it last
 * checked, and the buttons. Admins can connect one where there's none yet.
 */
export function MailboxStatus({ channelId }: { channelId: string }) {
  const { profile, isStaff } = useHub();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const isAdmin = profile.role === "admin" || profile.role === "owner";
  const timeZone = safeTimeZone(profile.timezone);
  const { data: connections, refetch } = useMailboxes();
  const status = connections?.find((c) => c.channel_id === channelId) ?? null;
  const connectHref = `/api/gmail/connect?channel=${channelId}`;

  // Coming back from Google: say how it went, once, then tidy the URL.
  const result = params.get("gmail");
  const inUse = params.get("in");
  useEffect(() => {
    if (!result) return;
    const [ok, text] = RETURN_MESSAGES[result] ?? RETURN_MESSAGES.error;
    if (ok) toast.success(text);
    else toast.error(result === "in_use" && inUse ? `That Google account already feeds #${inUse}.` : text);
    router.replace(window.location.pathname, { scroll: false });
  }, [result, inUse, router]);

  if (!isStaff || connections === undefined) return null;
  // Team-only channels that aren't email feeds stay quiet for everyone but admins.
  if (!status && !isAdmin) return null;

  const sync = () =>
    startTransition(async () => {
      const res = await syncMailNow(channelId);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.summary ?? "Checked.");
      await refetch();
    });

  return (
    <div className="border-rule bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)] flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm md:px-6">
      {status ? (
        <>
          {status.last_error ? (
            <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
          )}
          <p className="min-w-0 flex-1">
            <span className="font-medium">{status.email}</span>
            <span className="text-muted-foreground">
              {" "}
              · {status.last_synced_at ? `checked ${formatAge(new Date(status.last_synced_at), timeZone)} ago` : "connected, first check pending"}
            </span>
            {status.last_error && <span className="text-warning block text-xs">Last check had a problem: {status.last_error}</span>}
          </p>
          <Button variant="outline" className="h-9 cursor-pointer gap-1.5 px-3 text-[13px]" onClick={sync} disabled={pending}>
            <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden /> {pending ? "Checking…" : "Check now"}
          </Button>
          {isAdmin && (
            <a href={connectHref} className="text-muted-foreground hover:text-foreground text-[13px] underline-offset-4 hover:underline">
              Reconnect
            </a>
          )}
        </>
      ) : (
        <>
          <Plug className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <p className="text-muted-foreground min-w-0 flex-1">
            No mailbox is connected here. Connect a Gmail account (like support@) to bring its emails into this channel.
          </p>
          <Button
            nativeButton={false}
            render={<a href={connectHref} />}
            className="bg-ink text-background hover:bg-ink/90 h-9 cursor-pointer px-3 text-[13px] font-semibold"
          >
            Connect Gmail
          </Button>
        </>
      )}
    </div>
  );
}
