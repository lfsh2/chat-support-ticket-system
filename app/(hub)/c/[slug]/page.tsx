import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelView } from "@/components/chat/channel-view";
import { requireHubAccess } from "@/lib/session";
import { MESSAGE_SELECT, PAGE_SIZE, type ChatMessage } from "@/lib/chat/types";
import { APP_NAME } from "@/lib/config";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `#${slug} · ${APP_NAME}` };
}

export default async function ChannelPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { supabase, profile } = await requireHubAccess();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, slug, name, description, program, type")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (!channel) notFound();

  const [{ data: messages }, { data: readState }] = await Promise.all([
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("channel_id", channel.id)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
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
    />
  );
}
