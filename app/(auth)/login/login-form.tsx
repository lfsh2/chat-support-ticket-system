"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          We sent a sign-in link to <span className="text-foreground font-medium">{state.email}</span>. Tap it on this
          device to open the hub. It works for one hour.
        </p>
        <form action={action} className="mt-2">
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next ?? ""} />
          <Button type="submit" variant="ghost" className="h-11 px-4" disabled={pending}>
            {pending ? "Sending…" : "Send it again"}
          </Button>
        </form>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : undefined;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          // Remount when the server echoes the email back, so defaultValue stays uncontrolled.
          key={state.status === "error" ? `err:${state.email}` : "idle"}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="you@example.com"
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : "email-hint"}
          className="h-12 rounded-xl px-4 text-base"
        />
        {error ? (
          <FieldError id="email-error">{error}</FieldError>
        ) : (
          <FieldDescription id="email-hint">Use the email you signed up or paid with.</FieldDescription>
        )}
      </Field>
      <Button type="submit" className="h-12 rounded-xl text-base" disabled={pending}>
        {pending ? "Sending your link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
