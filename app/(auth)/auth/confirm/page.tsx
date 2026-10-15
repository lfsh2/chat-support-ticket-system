import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { AuthCard } from "../../auth-card";
import { confirmSignIn } from "./actions";

export const metadata: Metadata = {
  title: `Sign in · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

/**
 * Magic-link landing. Uses token_hash (not PKCE) so the link works even when it's opened
 * in a different browser or device than the one that asked for it. Signing in waits for a
 * tap: chat-app link previews and email scanners open links too, and would otherwise use
 * up the one-time link before the person does.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tokenHash = one(sp.token_hash);
  if (!tokenHash) redirect("/login?error=link");

  return (
    <AuthCard title="You're almost in" subtitle="Tap the button to finish signing in to your Client Hub.">
      <form action={confirmSignIn}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={one(sp.type) || "email"} />
        <input type="hidden" name="next" value={one(sp.next)} />
        <Button type="submit" className="bg-ink text-background hover:bg-ink/90 h-12 w-full cursor-pointer text-base font-semibold">
          Continue to Client Hub
        </Button>
      </form>
      <p className="text-muted-foreground mt-4 text-sm">This link works once and expires an hour after it was sent.</p>
    </AuthCard>
  );
}
