import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Serif wordmark with the two program ticks. Replaces a generic letter-in-a-tile logo. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2 font-display text-[22px] leading-none tracking-tight", className)}>
      {APP_NAME}
      <span className="inline-flex translate-y-[-0.1em] gap-[3px]" aria-hidden>
        <span className="bg-accent-af h-[0.7em] w-[3px] rounded-full" />
        <span className="bg-accent-coachos h-[0.7em] w-[3px] rounded-full" />
      </span>
    </span>
  );
}
