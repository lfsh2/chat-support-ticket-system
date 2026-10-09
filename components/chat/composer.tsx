"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileText, Megaphone, Paperclip, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ATTACHMENT_BYTES } from "@/lib/chat/types";

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
  children,
}: {
  draftId: string;
  placeholder: string;
  onSend: (body: string, files: File[]) => boolean;
  /** "note" tints the box for staff-only internal notes. */
  tone?: "default" | "note";
  /** Extra controls above the box (e.g. reply / internal note switch). */
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
    if (onSend(value.trim(), files)) {
      setValue("");
      setFiles([]);
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
            onChange={(e) => setValue(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            onKeyDown={(e) => {
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
    </form>
  );
}

export function ReadOnlyNotice({ channelName }: { channelName: string }) {
  return (
    <div className="border-rule text-muted-foreground mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex shrink-0 items-start gap-2.5 border-t pt-3 text-sm md:mx-6 md:mb-5">
      <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>Only the team posts in #{channelName}. You can react to any post with an emoji.</p>
    </div>
  );
}
