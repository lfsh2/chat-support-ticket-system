"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Page header. The top rule carries the program colour (brown / blue / ink for shared),
 * so you always know which "world" you're in. Mobile: ☰ opens the channel sheet.
 */
export function TopBar({
  title,
  subtitle,
  actions,
  accent,
  showMenu = true,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: string;
  showMenu?: boolean;
  className?: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <header
      className={cn(
        "paper border-rule relative z-20 flex min-h-14 shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)] md:min-h-16 md:px-6",
        className,
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent ?? "var(--ink)", opacity: accent ? 1 : 0.12 }}
        aria-hidden
      />
      {showMenu && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 cursor-pointer md:hidden"
          onClick={() => setOpenMobile(true)}
          aria-label="Open channels"
        >
          <Menu className="size-5" />
        </Button>
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-3 px-1">
        <h1 className="font-display flex min-w-0 items-baseline gap-1 truncate text-[21px] leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground border-rule hidden truncate border-l pl-3 text-sm md:block">{subtitle}</p>
        )}
      </div>
      {actions}
    </header>
  );
}
