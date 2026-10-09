"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROGRAMS } from "@/lib/config";
import { PRIORITY_LABEL, PRIORITY_ORDER, QUEUE_VIEWS, type QueueView } from "@/lib/tickets";
import { cn } from "@/lib/utils";

const ALL = "all";

export function QueueFilters({
  view,
  program,
  priority,
  counts,
}: {
  view: QueueView;
  program?: string;
  priority?: string;
  counts: Record<QueueView, number | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === ALL || (k === "view" && v === "open")) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-3 md:flex-row md:items-center md:px-6">
      <nav aria-label="Queue views" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-1 md:pb-0">
        {(Object.keys(QUEUE_VIEWS) as QueueView[]).map((v) => {
          const active = v === view;
          return (
            <Link
              key={v}
              href={hrefWith({ view: v })}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-ink text-background border-ink"
                  : "border-rule text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              {QUEUE_VIEWS[v].label}
              {counts[v] !== null && <span className={cn("tabular-nums", active ? "opacity-70" : "")}>{counts[v]}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex gap-2">
        <Select
          value={program ?? ALL}
          onValueChange={(v) => router.replace(hrefWith({ program: v as string }), { scroll: false })}
          items={{ [ALL]: "All programs", coachos: PROGRAMS.coachos.label, alive_free: PROGRAMS.alive_free.label }}
        >
          <SelectTrigger aria-label="Program" className="h-10 min-w-36 flex-1 cursor-pointer md:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All programs</SelectItem>
            <SelectItem value="coachos">{PROGRAMS.coachos.label}</SelectItem>
            <SelectItem value="alive_free">{PROGRAMS.alive_free.label}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priority ?? ALL}
          onValueChange={(v) => router.replace(hrefWith({ priority: v as string }), { scroll: false })}
          items={{ [ALL]: "Any priority", ...PRIORITY_LABEL }}
        >
          <SelectTrigger aria-label="Priority" className="h-10 min-w-32 flex-1 cursor-pointer md:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any priority</SelectItem>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
