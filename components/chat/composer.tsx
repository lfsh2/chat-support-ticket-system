"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AtSign, FileText, Megaphone, Paperclip, SendHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ATTACHMENT_BYTES } from "@/lib/chat/types";
import { draftToBody, matchPeople, mentionQueryAt, type Mention } from "@/lib/mentions";
import { createClient } from "@/lib/supabase/client";
import { MentionPopover, type MentionPerson } from "./mention-popover";

/** Who can be @mentioned: everyone who can see this channel, or this ticket (notes: team only). */
export type MentionScope = { channelId?: string; ticketId?: string; notes?: boolean };

function useMentionCandidates(scope: MentionScope | undefined, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["mention-candidates", scope?.channelId ?? null, scope?.ticketId ?? null, Boolean(scope?.notes)],
    enabled: Boolean(scope) && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MentionPerson[]> => {
      const { data, error } = await supabase.rpc("mention_candidates", {
        ...(scope?.channelId ? { cid: scope.channelId } : {}),
        ...(scope?.ticketId ? { tid: scope.ticketId } : {}),
        notes: Boolean(scope?.notes),
      });
      if (error) throw error;
      return data;
    },
  });
}

const draftKey = (id: string) => `hub:draft:${id}`;

function readDraft(id: string) {
  try {
    return localStorage.getItem(draftKey(id)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(id: string, value: string) {
  try {
    if (value) localStorage.setItem(draftKey(id), value);
    else localStorage.removeItem(draftKey(id));
  } catch {
    // Storage unavailable (private mode) — drafts just won't persist.
  }
}

export function Composer({
  draftId,
  placeholder,
  onSend,
  tone = "default",
  mentionScope,
  onTyping,
  onStopTyping,
  autoFocus = false,
  children,
}: {
  draftId: string;
  placeholder: string;
  /** Gets the stored body (mentions already in `@[Name](user:id)` form). */
  onSend: (body: string, files: File[]) => boolean;
  /** "note" tints the box for staff-only internal notes. */
  tone?: "default" | "note";
  /** Turns on @mention suggestions. */
  mentionScope?: MentionScope;
  onTyping?: () => void;
  onStopTyping?: () => void;
  autoFocus?: boolean;
  /** Extra controls above the box (e.g. reply / internal note switch). */
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // --- @mentions ---------------------------------------------------------------
  const listId = useId();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const query = mentionScope && caret != null ? mentionQueryAt(value, caret) : null;
  const candidates = useMentionCandidates(mentionScope, query != null);
  const typed = query?.query ?? null;
  const matches = useMemo(
    () => (typed != null ? matchPeople(candidates.data ?? [], typed) : []),
    [typed, candidates.data],
  );
  const pickerOpen = query != null && query.start !== dismissedAt && matches.length > 0;
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));

  const syncCaret = () => setCaret(textarea.current?.selectionStart ?? null);

  // After inserting text programmatically, put the caret back in the same commit, before
  // any further keystrokes land (a frame later would let fast typing go in the wrong place).
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    const el = textarea.current;
    if (at == null || !el) return;
    pendingCaret.current = null;
    el.focus();
    el.setSelectionRange(at, at);
  }, [value]);

  const pick = (person: MentionPerson) => {
    if (!query || caret == null) return;
    const name = person.display_name;
    const next = `${value.slice(0, query.start)}@${name} ${value.slice(caret)}`;
    const at = query.start + name.length + 2;
    setValue(next);
    setMentions((prev) => (prev.some((m) => m.id === person.id) ? prev : [...prev, { id: person.id, name }]));
    setCaret(at);
    setActive(0);
    pendingCaret.current = at;
  };

  const startMention = () => {
    const el = textarea.current;
    const at = el?.selectionStart ?? value.length;
    const before = value.slice(0, at);
    const insert = before === "" || /\s$/.test(before) ? "@" : " @";
    const next = before + insert + value.slice(at);
    setValue(next);
    setDismissedAt(null);
    const pos = at + insert.length;
    setCaret(pos);
    pendingCaret.current = pos;
  };

  // Restore the draft after mount (localStorage isn't available during SSR).
  useEffect(() => {
    const draft = readDraft(draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    if (draft) setValue(draft);
  }, [draftId]);

  useEffect(() => writeDraft(draftId, value), [draftId, value]);

  // Auto-grow up to ~8 lines.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 || files.length > 0;

  const submit = () => {
    if (!canSend) return;
    if (onSend(draftToBody(value.trim(), mentions), files)) {
      setValue("");
      setFiles([]);
      setMentions([]);
      onStopTyping?.();
      textarea.current?.focus();
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    const ok = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (ok.length < picked.length) toast.error("Files over 10 MB can't be attached. Try sharing a link instead.");
    setFiles((prev) => [...prev, ...ok].slice(0, 10));
  };

  return (
    <form
      className="shrink-0 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {children}
      <div className="relative">
      {pickerOpen && (
        <MentionPopover id={listId} people={matches} active={activeIndex} onHover={setActive} onPick={pick} />
      )}
      <div
        data-tone={tone}
        className="bg-card border-rule focus-within:border-foreground/35 data-[tone=note]:border-warning data-[tone=note]:bg-[color-mix(in_oklab,var(--warning)_7%,var(--card))] rounded-xl border transition-colors duration-200"
      >
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-2 pt-2" aria-label="Attachments to send">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="border-rule flex max-w-52 items-center gap-2 rounded-md border py-1 pr-1 pl-2 text-sm">
                <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="truncate">{f.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-1 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-11 shrink-0 cursor-pointer rounded-lg"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach files"
          >
            <Paperclip className="size-5" />
          </Button>
          {mentionScope && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground -ml-1 size-11 shrink-0 cursor-pointer rounded-lg"
              onClick={startMention}
              aria-label="Mention someone"
            >
              <AtSign className="size-5" />
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Textarea
            ref={textarea}
            rows={1}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => {
              setValue(e.target.value);
              setCaret(e.target.selectionStart);
              if (e.target.value.trim()) onTyping?.();
            }}
            onSelect={syncCaret}
            onBlur={() => setCaret(null)}
            onFocus={syncCaret}
            aria-autocomplete={mentionScope ? "list" : undefined}
            aria-controls={pickerOpen ? listId : undefined}
            aria-activedescendant={pickerOpen ? `${listId}-${matches[activeIndex]?.id}` : undefined}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            onKeyDown={(e) => {
              if (pickerOpen) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  setActive((activeIndex + step + matches.length) % matches.length);
                  return;
                }
                if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  pick(matches[activeIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDismissedAt(query?.start ?? null);
                  return;
                }
              }
              // Enter sends on devices with a keyboard; on touch, Enter adds a new line.
              const hasKeyboard = window.matchMedia("(pointer: fine)").matches;
              if (e.key === "Enter" && !e.shiftKey && hasKeyboard && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            enterKeyHint="send"
            className="max-h-[200px] min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base leading-6 shadow-none focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
          />
          <Button
            type="submit"
            size="icon"
            // Empty: a quiet outline, not a washed-out blue block. Ready: solid ink.
            className="data-[ready=false]:text-muted-foreground data-[ready=true]:bg-ink data-[ready=true]:text-background data-[ready=true]:hover:bg-ink/90 size-11 shrink-0 cursor-pointer rounded-lg transition-colors duration-150 disabled:opacity-100 data-[ready=false]:bg-transparent"
            data-ready={canSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendHorizontal className="size-5" />
          </Button>
        </div>
      </div>
      </div>
    </form>
  );
}

export function ReadOnlyNotice({ channelName }: { channelName: string }) {
  return (
    <div className="border-rule text-muted-foreground mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex shrink-0 items-start gap-2.5 border-t pt-3 text-sm md:mx-6 md:mb-5">
      <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>Only the team posts in #{channelName}. You can react with an emoji, or reply in a thread.</p>
    </div>
  );
}
