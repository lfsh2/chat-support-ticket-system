import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** A ruled section with a margin-note heading and an optional "see all" link. */
export function Panel({
  title,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col", className)} aria-label={title}>
      <div className="border-rule flex items-baseline justify-between gap-3 border-b pb-2">
        <h3 className="note text-muted-foreground text-[17px]">{title}</h3>
        {href && (
          <Link href={href} className="text-foreground flex min-h-8 items-center gap-1 text-[13px] font-semibold hover:underline">
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}

/** A big serif numeral over a plain label — ruled, not boxed. */
export function Stat({
  value,
  label,
  href,
  tone = "default",
}: {
  value: number;
  label: string;
  href: string;
  tone?: "default" | "alert" | "warn";
}) {
  return (
    <Link
      href={href}
      className="group/stat border-rule hover:bg-muted/50 focus-visible:ring-ring/50 flex flex-col gap-1 border-t px-1 pt-3 pb-3 transition-colors outline-none focus-visible:ring-3 md:border-t-0 md:border-l md:px-5 md:first:border-l-0 md:first:pl-1"
    >
      <span
        className={cn(
          "font-display text-[40px] leading-none tracking-tight tabular-nums md:text-[48px]",
          value > 0 && tone === "alert" && "text-destructive",
          value > 0 && tone === "warn" && "text-warning",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground group-hover/stat:text-foreground text-[13px] font-semibold">{label}</span>
    </Link>
  );
}
