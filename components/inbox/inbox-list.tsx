"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shell/empty-state";
import { INBOX_KEY, INBOX_UNREAD_KEY, useHub } from "@/components/shell/hub-context";
import { UserAvatar } from "@/components/shell/user-avatar";
import { INBOX_LIMIT, INBOX_SELECT, inboxHref, inboxPreview, inboxTitle, visibleItems, type InboxItem } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/client";
import { dayKey, dayLabel, formatAge, safeTimeZone } from "@/lib/time";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const { profile, refreshInbox } = useHub();
  const timeZone = safeTimeZone(profile.timezone);
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  // Kept fresh by the hub's realtime subscription (it invalidates this key).
  const { data: items = initialItems } = useQuery({
    queryKey: INBOX_KEY,
    initialData: initialItems,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(INBOX_SELECT)
        .order("created_at", { ascending: false })
        .limit(INBOX_LIMIT);
      if (error) throw error;
      return visibleItems(data as unknown as InboxItem[]);
    },
  });

  const unreadCount = items.filter((i) => !i.read_at).length;
  const shown = filter === "unread" ? items.filter((i) => !i.read_at) : items;

  const setRead = (ids: string[] | "all") => {
    const now = new Date().toISOString();
    queryClient.setQueryData<InboxItem[]>(INBOX_KEY, (prev) =>
      prev?.map((i) => (ids === "all" || ids.includes(i.id) ? { ...i, read_at: i.read_at ?? now } : i)),
    );
    queryClient.setQueryData<number>(INBOX_UNREAD_KEY, (prev) =>
      ids === "all" ? 0 : Math.max(0, (prev ?? 0) - ids.length),
    );
    let q = supabase.from("notifications").update({ read_at: now }).eq("user_id", profile.id).is("read_at", null);
    if (ids !== "all") q = q.in("id", ids);
    q.then(({ error }) => {
      if (error) toast.error("That didn't save. Please try again.");
      refreshInbox();
    });
  };

  // Day groups, newest first.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: InboxItem[] }[] = [];
    for (const item of shown) {
      const at = new Date(item.created_at ?? 0);
      const key = dayKey(at, timeZone);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(item);
      else out.push({ key, label: dayLabel(at, timeZone), items: [item] });
    }
    return out;
  }, [shown, timeZone]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-8 md:px-8 md:pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as Filter)} size="sm" aria-label="Show">
            <ToggleGroupItem value="all" className="data-pressed:bg-muted h-10 cursor-pointer px-3.5 text-[13px] font-semibold">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" className="data-pressed:bg-muted h-10 cursor-pointer px-3.5 text-[13px] font-semibold">
              Unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="ghost"
            className="ml-auto h-10 cursor-pointer gap-2 px-3 text-[13px] font-semibold"
            disabled={unreadCount === 0}
            onClick={() => setRead("all")}
          >
            <CheckCheck className="size-4" aria-hidden /> Mark all as read
          </Button>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            eyebrow={filter === "unread" ? "Nothing new" : "Mentions and replies"}
            title="You're all caught up."
          >
            When someone mentions you, replies to your thread, or updates one of your tickets, it&apos;ll land here.
            Type @ in any message to mention someone.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-label={g.label} className="mt-6">
              <h2 className="note text-muted-foreground border-rule border-b pb-1.5 text-[15px]">{g.label}</h2>
              <ul>
                {g.items.map((item) => (
                  <InboxRow key={item.id} item={item} timeZone={timeZone} onOpen={() => !item.read_at && setRead([item.id])} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function InboxRow({ item, timeZone, onOpen }: { item: InboxItem; timeZone: string; onOpen: () => void }) {
  const href = inboxHref(item);
  const { who, what } = inboxTitle(item);
  const preview = inboxPreview(item);
  const unread = !item.read_at;
  const author = item.message?.author;
  const at = new Date(item.created_at ?? 0);

  const body = (
    <>
      <span className="relative mt-0.5 shrink-0">
        <UserAvatar name={author?.display_name ?? "Team"} src={author?.avatar_url} seed={author?.id} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] leading-snug", unread ? "text-foreground" : "text-foreground/80")}>
          <span className="font-semibold">{who}</span> {what}
          {item.ticket && <span className="text-muted-foreground"> · {item.ticket.subject}</span>}
        </span>
        {preview && (
          <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-[14px] leading-snug">{preview}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <time dateTime={item.created_at ?? undefined} className="text-muted-foreground text-xs tabular-nums" suppressHydrationWarning>
          {formatAge(at, timeZone)}
        </time>
        {unread && <span className="bg-primary size-2 rounded-full" aria-hidden />}
      </span>
      {unread && <span className="sr-only">, unread</span>}
    </>
  );

  const className = cn(
    "border-rule -mx-2 flex min-h-16 items-start gap-3 rounded-lg border-b px-2 py-3 transition-colors last:border-b-0",
    href && "hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2",
  );

  return (
    <li>
      {href ? (
        <Link href={href} onClick={onOpen} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
