"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResponsiveDialog } from "@/components/shell/responsive-dialog";
import { openTicket, type NewTicketInput } from "@/app/(hub)/dashboard/tickets/actions";
import { PROGRAMS } from "@/lib/config";
import { CATEGORY_LABEL, CATEGORY_ORDER, type TicketCategory } from "@/lib/tickets";
import type { Program } from "@/lib/access";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "hub:ticket-draft";

type Draft = { program: Program | null; category: TicketCategory | null; subject: string; body: string; blocking: boolean };
const EMPTY: Draft = { program: null, category: null, subject: "", body: "", blocking: false };

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
function saveDraft(d: Draft) {
  try {
    if (d.subject || d.body || d.category) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private mode: the draft just won't survive a reload.
  }
}

const SUPPORT_HOURS = "We usually reply within one business day.";

/**
 * "Get help" in up to three short steps: which program (skipped with only one),
 * what it's about, then the details. The draft is kept in this browser until sent.
 */
export function NewTicketFlow({
  programs,
  open,
  onOpenChange,
  onCreated,
}: {
  programs: Program[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (number: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const askProgram = programs.length > 1;
  const steps = askProgram ? (["program", "category", "details"] as const) : (["category", "details"] as const);
  const current = steps[Math.min(step, steps.length - 1)];

  // Restore the draft each time the flow opens — and only then, so a refresh mid-flow
  // doesn't send someone back to step one. Effects are client-only, so storage is safe.
  useEffect(() => {
    if (!open) return;
    const d = loadDraft();
    const program = d.program && programs.includes(d.program) ? d.program : programs.length === 1 ? programs[0] : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage on open
    setDraft({ ...d, program });
    setStep(0);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed to opening only
  }, [open]);

  const update = (patch: Partial<Draft>) =>
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });

  const canNext = current === "program" ? Boolean(draft.program) : current === "category" ? Boolean(draft.category) : true;

  const submit = () => {
    if (!draft.program || !draft.category) return;
    setError(null);
    const input: NewTicketInput = {
      program: draft.program,
      category: draft.category,
      subject: draft.subject,
      body: draft.body,
      blocking: draft.blocking,
    };
    startTransition(async () => {
      const res = await openTicket(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      saveDraft(EMPTY);
      toast.success(`Ticket #${res.number} opened.`, { description: SUPPORT_HOURS });
      onCreated(res.number);
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title="Get help"
      description={SUPPORT_HOURS}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Progress
            value={((step + 1) / steps.length) * 100}
            className="flex-1"
            aria-label={`Step ${step + 1} of ${steps.length}`}
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            Step {step + 1} of {steps.length}
          </span>
        </div>

        {current === "program" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="font-display mb-3 text-[20px] leading-tight">Which program is this about?</legend>
            <ToggleGroup
              value={draft.program ? [draft.program] : []}
              onValueChange={(v) => {
                const program = (v[0] as Program | undefined) ?? null;
                update({ program });
                if (program) setStep(1);
              }}
              orientation="vertical"
              className="w-full"
            >
              {programs.map((p) => (
                <ToggleGroupItem
                  key={p}
                  value={p}
                  variant="outline"
                  className="data-pressed:border-foreground data-pressed:bg-muted h-16 w-full cursor-pointer justify-start gap-3 rounded-xl px-4 text-left text-base"
                >
                  <span className="h-8 w-1 rounded-full" style={{ background: PROGRAMS[p].accent }} aria-hidden />
                  <span className="font-semibold">{PROGRAMS[p].label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
        )}

        {current === "category" && (
          <fieldset className="flex flex-col">
            <legend className="font-display mb-3 text-[20px] leading-tight">What&apos;s this about?</legend>
            <ToggleGroup
              value={draft.category ? [draft.category] : []}
              onValueChange={(v) => {
                const category = (v[0] as TicketCategory | undefined) ?? null;
                update({ category });
                if (category) setStep(step + 1);
              }}
              className="flex w-full flex-wrap justify-start gap-2"
            >
              {CATEGORY_ORDER.map((c) => (
                <ToggleGroupItem
                  key={c}
                  value={c}
                  variant="outline"
                  className="data-pressed:bg-ink data-pressed:text-background data-pressed:border-ink h-11 cursor-pointer rounded-full px-4 text-[15px]"
                >
                  {CATEGORY_LABEL[c]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
        )}

        {current === "details" && (
          <form
            id="new-ticket"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p className="text-muted-foreground -mt-1 text-sm">
              {draft.program && PROGRAMS[draft.program].label}
              {draft.category && <> · {CATEGORY_LABEL[draft.category]}</>}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                autoFocus
                value={draft.subject}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder="e.g. My domain won't verify"
                maxLength={160}
                required
                className="h-11 text-base md:text-[15px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-body">Tell us more</Label>
              <Textarea
                id="ticket-body"
                value={draft.body}
                onChange={(e) => update({ body: e.target.value })}
                placeholder="What were you trying to do, and what happened instead? Links and screenshots help."
                required
                className="min-h-32 text-base md:text-[15px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-urgency">How urgent is it?</Label>
              <Select
                value={draft.blocking ? "blocking" : "normal"}
                onValueChange={(v) => update({ blocking: v === "blocking" })}
                items={{ normal: "Normal", blocking: "It's blocking me" }}
              >
                <SelectTrigger id="ticket-urgency" className="h-11 w-full text-base md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="blocking">It&apos;s blocking me</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </form>
        )}

        <div className="flex items-center gap-2 pt-1">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer gap-1.5 px-3"
              onClick={() => setStep(step - 1)}
              disabled={pending}
            >
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          )}
          <div className="flex-1" />
          {current === "details" ? (
            <Button
              type="submit"
              form="new-ticket"
              disabled={pending || !draft.subject.trim() || !draft.body.trim()}
              className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
            >
              {pending ? "Sending…" : "Send to the team"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className={cn("bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold")}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}

/** A button that opens the flow. `autoOpen` supports links like /dashboard/tickets?new=1. */
export function GetHelpButton({
  programs,
  autoOpen = false,
  className,
  children = "Get help",
}: {
  programs: Program[];
  autoOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(autoOpen);
  const router = useRouter();
  // Following a ?new=1 link while already on this page should open it too.
  const [prevAuto, setPrevAuto] = useState(autoOpen);
  if (autoOpen !== prevAuto) {
    setPrevAuto(autoOpen);
    if (autoOpen) setOpen(true);
  }
  if (programs.length === 0) return null;
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn("bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold", className)}
      >
        {children}
      </Button>
      <NewTicketFlow
        programs={programs}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Drop ?new=1 so a refresh doesn't pop the flow open again.
          if (!next && autoOpen) router.replace("/dashboard/tickets", { scroll: false });
        }}
        onCreated={(number) => {
          setOpen(false);
          router.push(`/dashboard/tickets/${number}`);
        }}
      />
    </>
  );
}
