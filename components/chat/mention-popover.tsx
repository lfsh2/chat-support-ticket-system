"use client";

import { UserAvatar } from "@/components/shell/user-avatar";
import { isStaffRole } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { PresenceDot } from "./presence-dot";

export type MentionPerson = Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url" | "role">;

/**
 * The @mention suggestion list above the composer. Focus stays in the text box (arrow keys
 * move the highlight, Enter or Tab picks), so it's a listbox tied to the textarea with
 * aria-activedescendant rather than a focus-taking popover.
 */
export function MentionPopover({
  id,
  people,
  active,
  onHover,
  onPick,
}: {
  id: string;
  people: MentionPerson[];
  active: number;
  onHover: (index: number) => void;
  onPick: (person: MentionPerson) => void;
}) {
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-lg shadow-md ring-1 duration-100 md:right-auto md:w-80">
      <p className="note text-muted-foreground px-3 pt-2 pb-1 text-[13px]">Mention someone</p>
      <ul id={id} role="listbox" aria-label="People to mention" className="max-h-64 overflow-y-auto pb-1">
        {people.map((p, i) => (
          <li
            key={p.id}
            id={`${id}-${p.id}`}
            role="option"
            aria-selected={i === active}
            // Keep focus (and the caret) in the text box.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(p)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[15px]",
              i === active && "bg-muted",
            )}
          >
            <span className="relative shrink-0">
              <UserAvatar name={p.display_name} src={p.avatar_url} seed={p.id} className="size-7 text-[10px]" />
              <PresenceDot userId={p.id} className="size-2" />
            </span>
            <span className="min-w-0 flex-1 truncate">{p.display_name}</span>
            {isStaffRole(p.role) && <span className="note text-muted-foreground text-[13px]">team</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
