"use client";

import { useIsOnline } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";

/** Small green dot on an avatar's corner while that person has the hub open. */
export function PresenceDot({ userId, className }: { userId: string | null | undefined; className?: string }) {
  const online = useIsOnline(userId);
  if (!online) return null;
  return (
    <span
      className={cn("bg-success ring-background absolute right-0 bottom-0 size-2.5 rounded-full ring-2", className)}
      role="img"
      aria-label="Online"
    />
  );
}
