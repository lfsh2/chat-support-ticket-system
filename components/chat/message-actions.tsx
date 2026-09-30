"use client";

import { Copy, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QUICK_REACTIONS } from "@/lib/chat/types";

export type MessageActionHandlers = {
  canEdit: boolean;
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function EmojiRow({ onReact, size = "md" }: { onReact: (emoji: string) => void; size?: "md" | "lg" }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Add a reaction">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className={
            size === "lg"
              ? "hover:bg-muted flex size-12 items-center justify-center rounded-full text-2xl"
              : "hover:bg-muted flex size-8 items-center justify-center rounded-md text-lg"
          }
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Desktop: floating toolbar shown on hover/focus. */
export function MessageToolbar({ canEdit, canDelete, onReact, onCopy, onEdit, onDelete }: MessageActionHandlers) {
  return (
    <div className="bg-card border-rule absolute -top-4 right-4 z-10 hidden items-center rounded-md border p-0.5 opacity-0 md:right-6 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 md:flex has-data-popup-open:opacity-100 has-aria-expanded:opacity-100">
      {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
        <Button key={emoji} variant="ghost" size="icon-sm" onClick={() => onReact(emoji)} aria-label={`React with ${emoji}`}>
          <span className="text-base">{emoji}</span>
        </Button>
      ))}
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More reactions" />}>
          <SmilePlus />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align="end">
          <EmojiRow onReact={onReact} />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={onCopy}>
            <Copy /> Copy text
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Edit message
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete message
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Desktop: right-click menu (rendered inside a <ContextMenu>). */
export function MessageContextMenu({ canEdit, canDelete, onReact, onCopy, onEdit, onDelete }: MessageActionHandlers) {
  return (
    <ContextMenuContent className="min-w-44">
      <div className="p-1">
        <EmojiRow onReact={onReact} />
      </div>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onCopy}>
        <Copy /> Copy text
      </ContextMenuItem>
      {canEdit && (
        <ContextMenuItem onClick={onEdit}>
          <Pencil /> Edit message
        </ContextMenuItem>
      )}
      {canDelete && (
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Delete message
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );
}

/** Mobile: long-press opens this bottom drawer. */
export function MessageActionDrawer({
  open,
  onOpenChange,
  preview,
  ...h
}: MessageActionHandlers & { open: boolean; onOpenChange: (open: boolean) => void; preview: string }) {
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="sr-only">Message actions</DrawerTitle>
          <DrawerDescription className="line-clamp-2 text-sm">{preview || "Attachment"}</DrawerDescription>
        </DrawerHeader>
        <div className="flex justify-center px-4 pb-2">
          <EmojiRow size="lg" onReact={(e) => run(() => h.onReact(e))()} />
        </div>
        <div className="flex flex-col px-2">
          <Button variant="ghost" className="h-12 justify-start gap-3 px-4 text-base" onClick={run(h.onCopy)}>
            <Copy className="size-5" /> Copy text
          </Button>
          {h.canEdit && (
            <Button variant="ghost" className="h-12 justify-start gap-3 px-4 text-base" onClick={run(h.onEdit)}>
              <Pencil className="size-5" /> Edit message
            </Button>
          )}
          {h.canDelete && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive h-12 justify-start gap-3 px-4 text-base"
              onClick={run(h.onDelete)}
            >
              <Trash2 className="size-5" /> Delete message
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
