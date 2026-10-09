import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activePrograms, isStaffRole, type Program } from "@/lib/access";

/** Current user's profile + access, once per request. Redirects if signed out or lapsed. */
export const requireHubAccess = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: hasAccess }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.rpc("has_any_access"),
  ]);
  if (!profile) redirect("/login");
  if (!hasAccess) redirect("/access-ended");

  return { supabase, profile };
});

/** Programs the current user can open tickets in. Staff can file for either. */
export const myPrograms = cache(async (): Promise<Program[]> => {
  const { supabase, profile } = await requireHubAccess();
  if (isStaffRole(profile.role)) return ["coachos", "alive_free"];
  const { data } = await supabase.from("memberships").select("program, status, grace_until").eq("user_id", profile.id);
  return activePrograms(data ?? []);
});
