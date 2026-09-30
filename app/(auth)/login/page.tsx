import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title={`Welcome to ${APP_NAME}`}
      subtitle="Chat with the team, get help, and find answers. No password needed."
    >
      {error === "link" && (
        <p className="bg-warning/10 text-foreground mb-4 rounded-xl px-4 py-3 text-sm" role="alert">
          That sign-in link has expired or was already used. Enter your email to get a new one.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </AuthCard>
  );
}
