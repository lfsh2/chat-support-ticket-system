import type { Tables } from "@/lib/database.types";

export type Attachment = {
  path: string;
  name: string;
  size: number;
  type: string;
  /** Local object URL while an upload is in flight (never persisted). */
  previewUrl?: string;
};

export type Author = Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url" | "role">;
export type Reaction = Pick<Tables<"reactions">, "emoji" | "user_id">;

export type ChatMessage = Omit<Tables<"messages">, "attachments"> & {
  attachments: Attachment[];
  author: Author | null;
  reactions: Reaction[];
  /** Client-only send state for optimistic messages. */
  status?: "sending" | "failed";
};

export const MESSAGE_SELECT =
  "*, author:profiles!messages_author_id_fkey(id, display_name, avatar_url, role), reactions(emoji, user_id)" as const;

export const PAGE_SIZE = 50;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "👀", "✅"] as const;
