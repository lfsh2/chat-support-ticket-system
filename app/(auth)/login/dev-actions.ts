"use server";

import { redirect } from "next/navigation";
import { signInAsDevUser } from "@/lib/dev-login";

export async function devSignIn(formData: FormData) {
  try {
    await signInAsDevUser(String(formData.get("email") ?? ""));
  } catch (err) {
    console.error("dev sign-in failed:", err instanceof Error ? err.message : err);
    redirect("/login?error=dev");
  }
  redirect("/");
}
