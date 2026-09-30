import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: `Membership ended · ${APP_NAME}` };

export default function AccessEndedPage() {
  return (
    <AuthCard
      title="Your membership has ended"
      subtitle="Thanks for being part of the community. Renew your membership to get back into the hub. Your old messages and tickets will still be here."
    >
      <div className="flex flex-col gap-3">
        {/* TODO(phase 6): link to the Stripe Customer Portal */}
        <Button
          nativeButton={false}
          render={<a href={`mailto:${SUPPORT_EMAIL}?subject=Renew%20my%20membership`} />}
          className="bg-ink text-background hover:bg-ink/90 h-12 rounded-xl text-base font-semibold"
        >
          Renew my membership
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-12 w-full rounded-xl text-base">
            Sign out
          </Button>
        </form>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Think this is a mistake? Email <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          and we&apos;ll sort it out.
        </p>
      </div>
    </AuthCard>
  );
}
