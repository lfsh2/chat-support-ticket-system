import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChannelView } from "@/components/chat/channel-view";
import { requireHubAccess } from "@/lib/session";
import { MESSAGE_SELECT, PAGE_SIZE, type ChatMessage } from "@/lib/chat/types";
import { APP_NAME } from "@/lib/config";

type Params = PageProps<"/c/[slug]/[[...thread]]">;

/** Enough history to include a deep-linked message, within reason. */
const MAX_DEEP_LINK_MESSAGES = 1000;

const uuid = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, thread } = await params;
  return { title: `${thread?.length ? "Thread in " : ""}#${slug} · ${APP_NAME}` };
}

/**
 * /c/<slug>              the channel
 * /c/<slug>/t/<id>       the channel with a message's thread open
 * ?m=<id>                scroll to and flash a message (links from the Inbox)
 */
export default async function ChannelPage({ params, searchParams }: Params) {
  const [{ slug, thread }, sp] = await Promise.all([params, searchParams]);
  if (thread && (thread.length !== 2 || thread[0] !== "t" || !uuid(thread[1]))) notFound();
  const threadId = thread?.[1] ?? null;
  const highlightId = uuid(sp.m);
  const { supabase, profile } = await requireHubAccess();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, slug, name, description, program, type, parent_id, client_id, staff_only")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (!channel) notFound();

  // Deep links: make sure the target (the open thread's parent, or the highlighted message)
  // is among the messages we render, so the page can scroll to it.
  let limit = PAGE_SIZE;
  const targetId = threadId ?? highlightId;
  if (targetId) {
    const { data: target } = await supabase
      .from("messages")
      .select("id, channel_id, parent_id, created_at")
      .eq("id", targetId)
      .maybeSingle();
    if (target?.channel_id === channel.id && target.parent_id && !threadId) {
      // A reply: open its thread.
      redirect(`/c/${channel.slug}/t/${target.parent_id}?m=${target.id}`);
    }
    if (target?.channel_id === channel.id && !target.parent_id && target.created_at) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channel.id)
        .is("parent_id", null)
        .gt("created_at", target.created_at);
      limit = Math.min(Math.max(PAGE_SIZE, (count ?? 0) + 15), MAX_DEEP_LINK_MESSAGES);
    }
  }

  const [{ data: messages }, { data: readState }] = await Promise.all([
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("channel_id", channel.id)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("read_states")
      .select("last_read_at")
      .eq("user_id", profile.id)
      .eq("channel_id", channel.id)
      .maybeSingle(),
  ]);

  return (
    <ChannelView
      key={channel.id}
      channel={channel}
      initialMessages={(messages ?? []) as unknown as ChatMessage[]}
      lastReadAt={readState?.last_read_at ?? null}
      highlightId={highlightId}
    />
  );
}
