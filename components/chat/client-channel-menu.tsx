"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveDialog } from "@/components/shell/responsive-dialog";
import { useHub } from "@/components/shell/hub-context";
import { archiveClientChannel, renameClientChannel } from "@/app/(hub)/c/actions";

/** Admin-only menu on a client channel's header: rename, archive. */
export function ClientChannelMenu({ channel }: { channel: { id: string; name: string; parent_id: string | null } }) {
  const router = useRouter();
  const { channels } = useHub();
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [name, setName] = useState(channel.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parent = channels.find((c) => c.id === channel.parent_id);

  const rename = () =>
    startTransition(async () => {
      const res = await renameClientChannel(channel.id, name);
      if (!res.ok) return setError(res.error);
      setRenaming(false);
      toast.success("Channel renamed.");
    });

  const archive = () =>
    startTransition(async () => {
      const res = await archiveClientChannel(channel.id);
      if (!res.ok) return void toast.error(res.error);
      setArchiving(false);
      toast.success("Channel archived. Its messages are kept.");
      router.push(parent ? `/c/${parent.slug}` : "/c");
      router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="size-11 cursor-pointer" aria-label="Channel options" />}
        >
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            onClick={() => {
              setName(channel.name);
              setError(null);
              setRenaming(true);
            }}
          >
            Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setArchiving(true)}>
            Archive…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog open={renaming} onOpenChange={(o) => !pending && setRenaming(o)} title="Rename channel">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input
              id="channel-name"
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-base md:text-[15px]"
            />
            <p className="text-muted-foreground text-xs">Lowercase, with dashes for spaces. Only this client and the team see it.</p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-11 cursor-pointer px-4" onClick={() => setRenaming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold">
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive #{channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the sidebar for the client and the team. Messages are kept, and nobody can post in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-11" onClick={archive} disabled={pending}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
