import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_CHANNEL_COOKIE } from "@/lib/chat/last-channel";

// "/" → last visited channel, or #general.
export default async function HubHome() {
  const last = (await cookies()).get(LAST_CHANNEL_COOKIE)?.value;
  redirect(`/c/${last && /^[a-z0-9-]+$/.test(last) ? last : "general"}`);
}
