"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Mobile: ☰ opens the channel sheet. Desktop: plain header row. */
export function TopBar({
  title,
  subtitle,
  actions,
  showMenu = true,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  showMenu?: boolean;
  className?: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <header
      className={cn(
        "bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:px-4",
        className,
      )}
    >
      {showMenu && (
        <Button variant="ghost" size="icon" className="size-11 md:hidden" onClick={() => setOpenMobile(true)} aria-label="Open channels">
          <Menu className="size-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1 px-1">
        <h1 className="flex items-center gap-1 truncate text-[17px] font-semibold">{title}</h1>
        {subtitle && <p className="text-muted-foreground hidden truncate text-xs sm:block">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
