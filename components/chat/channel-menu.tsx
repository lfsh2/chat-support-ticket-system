"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useHub } from "@/components/shell/hub-context";
import { archiveChannel } from "@/app/(hub)/c/actions";
import { PROTECTED_CHANNEL_SLUGS } from "@/lib/channels";
import { ChannelFormDialog } from "./channel-form-dialog";

/** Admin-only menu on a (non-client) channel's header: edit, archive. */
export function ChannelMenu({ channelId }: { channelId: string }) {
  const router = useRouter();
  const { channels } = useHub();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [pending, startTransition] = useTransition();
  const channel = channels.find((c) => c.id === channelId);
  if (!channel) return null;
  const canArchive = !PROTECTED_CHANNEL_SLUGS.has(channel.slug);

  const archive = () =>
    startTransition(async () => {
      const res = await archiveChannel(channel.id);
      if (!res.ok) return void toast.error(res.error);
      setArchiving(false);
      toast.success("Channel archived. Its messages are kept.");
      router.push("/c");
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
          <DropdownMenuItem onClick={() => setEditing(true)}>Edit channel…</DropdownMenuItem>
          {canArchive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setArchiving(true)}>
                Archive…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChannelFormDialog open={editing} onOpenChange={setEditing} channel={channel} />

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive #{channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the sidebar for everyone. Messages are kept, and nobody can post in it.
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
