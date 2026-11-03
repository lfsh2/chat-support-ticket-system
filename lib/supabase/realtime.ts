import type { RealtimeChannel, RealtimeChannelOptions, SupabaseClient } from "@supabase/supabase-js";

/**
 * Join a Realtime channel from an effect, safely across quick remounts.
 *
 * `supabase.channel(name)` hands back an existing channel with the same topic, even one that
 * is still leaving. React's dev double-mount (or closing and reopening a panel) would then
 * attach to a channel that closes a moment later. So: wait for any leftover channel with this
 * topic to finish leaving, then join a fresh one. Returns the effect cleanup.
 */
export function joinChannel(
  supabase: SupabaseClient,
  name: string,
  options: RealtimeChannelOptions = { config: {} },
  setup: (channel: RealtimeChannel) => void,
): () => void {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  const join = () => {
    if (cancelled) return;
    channel = supabase.channel(name, options);
    setup(channel);
  };

  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${name}`);
  if (stale) void supabase.removeChannel(stale).finally(join);
  else join();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
