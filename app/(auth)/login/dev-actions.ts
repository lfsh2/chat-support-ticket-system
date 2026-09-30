"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DEV_USERS, devLoginEnabled } from "@/lib/dev-login";

/** Dev only: mint a magic-link token server-side and verify it, skipping the inbox. */
export async function devSignIn(formData: FormData) {
  if (!devLoginEnabled()) throw new Error("Dev login is disabled.");

  const email = String(formData.get("email") ?? "");
  if (!DEV_USERS.some((u) => u.email === email)) throw new Error("Not a seeded dev user.");

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Couldn't create a dev link.");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw new Error(verifyError.message);

  redirect("/");
}
