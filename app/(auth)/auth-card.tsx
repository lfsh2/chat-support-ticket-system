import { APP_NAME, PROGRAMS } from "@/lib/config";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center sm:justify-center sm:pt-0">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="bg-sidebar text-sidebar-foreground ring-sidebar-border flex size-9 items-center justify-center rounded-xl text-sm font-bold ring-1 dark:ring-white/15">
            {APP_NAME.slice(0, 1)}
          </span>
          <span className="text-[17px] font-semibold">{APP_NAME}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 mb-8 text-[15px] leading-relaxed">{subtitle}</p>
        {children}
        <p className="text-muted-foreground mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>For clients of</span>
          {Object.values(PROGRAMS).map((p) => (
            <span key={p.label} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: p.accent }} aria-hidden />
              {p.label}
            </span>
          ))}
        </p>
      </div>
    </main>
  );
}
