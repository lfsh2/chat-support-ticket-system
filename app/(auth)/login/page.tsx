import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { AuthCard } from "../auth-card";
import { DevLoginPanel } from "./dev-login-panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="We'll email you a link. No password to remember."
    >
      {error === "link" && (
        <p className="border-warning text-foreground mb-6 border-l-2 py-1 pl-3 text-sm" role="alert">
          That sign-in link has expired or was already used. Enter your email to get a new one.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <DevLoginPanel />
    </AuthCard>
  );
}
