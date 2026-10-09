"use client";

import { useOptimistic, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rateTicket } from "@/app/(hub)/dashboard/tickets/actions";

/** Inline "Did this solve it?" card shown to the client on a resolved ticket. */
export function SatisfactionPrompt({ ticketId, satisfaction }: { ticketId: string; satisfaction: number | null }) {
  const [score, setScore] = useOptimistic(satisfaction);
  const [pending, startTransition] = useTransition();

  const rate = (value: 1 | -1) =>
    startTransition(async () => {
      setScore(value);
      const res = await rateTicket(ticketId, value);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className="border-rule mx-3 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 md:mx-6">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[18px] leading-tight">
          {score === 1 ? "Glad that sorted it." : score === -1 ? "Sorry it's still not right." : "We marked this resolved. Did this solve it?"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {score === -1 ? "Reply below and tell us what's still happening — we'll pick it back up." : "Still need help? Reply below and it'll reopen."}
        </p>
      </div>
      {score === null && (
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 cursor-pointer gap-2 px-4" onClick={() => rate(1)} disabled={pending}>
            <ThumbsUp className="size-4" aria-hidden /> Yes
          </Button>
          <Button variant="outline" className="h-11 cursor-pointer gap-2 px-4" onClick={() => rate(-1)} disabled={pending}>
            <ThumbsDown className="size-4" aria-hidden /> Not really
          </Button>
        </div>
      )}
    </div>
  );
}
