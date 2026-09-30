"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/chat/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function useSignedUrl(path: string) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["attachment-url", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function AttachmentItem({ a }: { a: Attachment }) {
  const { data: url } = useSignedUrl(a.path);
  const href = a.previewUrl ?? url;
  const isImage = a.type.startsWith("image/");

  if (isImage) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-muted block max-w-[min(100%,20rem)] overflow-hidden rounded-xl"
        aria-label={`Open image ${a.name}`}
      >
        {href ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URLs
          <img src={href} alt={a.name} loading="lazy" className="max-h-72 w-auto object-contain" />
        ) : (
          <div className="flex h-40 w-60 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" aria-label="Loading image" />
          </div>
        )}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={a.name}
      className="bg-muted hover:bg-accent flex max-w-xs items-center gap-3 rounded-xl px-3 py-2"
    >
      <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className="text-muted-foreground block text-xs">{formatSize(a.size)}</span>
      </span>
    </a>
  );
}

export function AttachmentPreview({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {attachments.map((a, i) => (
        <AttachmentItem key={a.path || `${a.name}-${i}`} a={a} />
      ))}
    </div>
  );
}
