"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResponsiveDialog } from "@/components/shell/responsive-dialog";
import type { HubChannel } from "@/components/shell/hub-context";
import { createChannel, updateChannel } from "@/app/(hub)/c/actions";
import { ALWAYS_TEAM_ONLY_SLUGS, toChannelName } from "@/lib/channels";
import type { Program } from "@/lib/access";
import { PROGRAMS } from "@/lib/config";

type Audience = "everyone" | Program;
type Form = { name: string; description: string; audience: Audience; type: HubChannel["type"]; staffOnly: boolean };

const AUDIENCE_HELP: Record<Audience, string> = {
  everyone: "Everyone with access to the hub, in both programs.",
  coachos: "Only CoachOS clients (and the team).",
  alive_free: "Only Alive & Free clients (and the team).",
};

const OPTION = "data-pressed:bg-muted h-11 flex-1 cursor-pointer px-3 text-[13px] font-semibold";

function formFor(channel: HubChannel | null, program: Program | null): Form {
  return channel
    ? {
        name: channel.name,
        description: channel.description ?? "",
        audience: channel.program ?? "everyone",
        type: channel.type,
        staffOnly: channel.staff_only,
      }
    : { name: "", description: "", audience: program ?? "everyone", type: "text", staffOnly: false };
}

/**
 * Admins: add a channel, or edit one. Creating picks the program (who can see it); editing
 * keeps it, since moving a channel would show its history to different clients.
 */
export function ChannelFormDialog({
  open,
  onOpenChange,
  channel = null,
  program = null,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The channel being edited; null to create one. */
  channel?: HubChannel | null;
  /** Creating: the group it was started from. */
  program?: Program | null;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formFor(channel, program));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = channel !== null;
  const lockedTeamOnly = editing && ALWAYS_TEAM_ONLY_SLUGS.has(channel.slug);

  // Fresh form every time it opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the dialog opens
    setForm(formFor(channel, program));
    setError(null);
  }, [open, channel, program]);

  const cleanName = toChannelName(form.name);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () =>
    startTransition(async () => {
      const fields = { name: form.name, description: form.description, type: form.type, staffOnly: form.staffOnly };
      if (editing) {
        const res = await updateChannel(channel.id, fields);
        if (!res.ok) return setError(res.error);
        onOpenChange(false);
        toast.success("Channel updated.");
        return;
      }
      const res = await createChannel({ ...fields, program: form.audience === "everyone" ? null : form.audience });
      if (!res.ok || !res.slug) return setError(res.ok ? "Something went wrong." : res.error);
      onOpenChange(false);
      toast.success(`#${res.slug} is ready.`);
      onCreated?.();
      router.push(`/c/${res.slug}`);
    });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={editing ? `Edit #${channel.name}` : "New channel"}
      description={editing ? undefined : "Channels are open conversations. Only admins can add or change them."}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-form-name">Name</Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base md:text-[15px]" aria-hidden>
              #
            </span>
            <Input
              id="channel-form-name"
              autoFocus
              value={form.name}
              maxLength={60}
              placeholder="e.g. support-email-ticket"
              onChange={(e) => set("name", e.target.value)}
              className="h-11 pl-7 text-base md:text-[15px]"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {cleanName && cleanName !== form.name.trim() ? (
              <>
                Will show as <span className="text-foreground font-medium">#{cleanName}</span>
              </>
            ) : (
              "Lowercase, with dashes for spaces."
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-form-description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="channel-form-description"
            value={form.description}
            maxLength={120}
            placeholder="What's it for?"
            onChange={(e) => set("description", e.target.value)}
            className="h-11 text-base md:text-[15px]"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Program</legend>
          {editing ? (
            <p className="text-sm">
              {form.audience === "everyone" ? "Everyone" : PROGRAMS[form.audience].label}
              <span className="text-muted-foreground"> · can&apos;t be changed after it&apos;s created</span>
            </p>
          ) : (
            <>
              <ToggleGroup
                value={[form.audience]}
                onValueChange={(v) => v[0] && set("audience", v[0] as Audience)}
                className="w-full"
              >
                <ToggleGroupItem value="everyone" className={OPTION}>
                  Everyone
                </ToggleGroupItem>
                <ToggleGroupItem value="coachos" className={OPTION}>
                  {PROGRAMS.coachos.label}
                </ToggleGroupItem>
                <ToggleGroupItem value="alive_free" className={OPTION}>
                  {PROGRAMS.alive_free.label}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground text-xs">{AUDIENCE_HELP[form.audience]}</p>
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Who can post</legend>
          <ToggleGroup
            value={[form.type]}
            onValueChange={(v) => v[0] && set("type", v[0] as Form["type"])}
            className="w-full"
          >
            <ToggleGroupItem value="text" className={OPTION}>
              Anyone in it
            </ToggleGroupItem>
            <ToggleGroupItem value="announcement" className={OPTION}>
              Only the team
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-muted-foreground text-xs">
            {form.type === "announcement"
              ? "Clients can read, react and reply in threads, but can't start new posts."
              : "Clients and the team can all post."}
          </p>
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-start justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Team only</span>
            <span className="text-muted-foreground text-xs">
              {lockedTeamOnly
                ? "This feed carries client emails, so it always stays team-only."
                : editing && channel.staff_only && !form.staffOnly
                  ? "Clients in this program will see everything already posted here."
                  : "Hidden from clients. Good for internal channels like an email feed."}
            </span>
          </span>
          <Switch
            className="mt-1"
            checked={lockedTeamOnly || form.staffOnly}
            disabled={lockedTeamOnly}
            onCheckedChange={(v) => set("staffOnly", v)}
          />
        </label>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" className="h-11 cursor-pointer px-4" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || cleanName.length < 2}
            className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
          >
            {pending ? "Saving…" : editing ? "Save" : "Create channel"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
