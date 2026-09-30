import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground size-7" aria-hidden />
      </div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children && <p className="text-muted-foreground max-w-sm text-[15px] leading-relaxed">{children}</p>}
      {action}
    </div>
  );
}
