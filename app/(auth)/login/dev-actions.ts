"use server";

import { redirect } from "next/navigation";
import { signInAsDevUser } from "@/lib/dev-login";

export async function devSignIn(formData: FormData) {
  await signInAsDevUser(String(formData.get("email") ?? ""));
  redirect("/");
}
