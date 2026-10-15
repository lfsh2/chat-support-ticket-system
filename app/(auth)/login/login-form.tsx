"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { requestMagicLink, signInWithPassword, type LoginState } from "./actions";

const inputClass = "bg-card h-12 rounded-xl px-4 text-base";
const primaryClass = "bg-ink text-background hover:bg-ink/90 h-12 rounded-xl text-base font-semibold";

/** Email + password by default; an emailed sign-in link is one tap away. */
export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  return mode === "password" ? (
    <PasswordForm next={next} onUseLink={() => setMode("link")} />
  ) : (
    <LinkForm next={next} onUsePassword={() => setMode("password")} />
  );
}

function EmailField({ state, error }: { state: LoginState; error?: string }) {
  return (
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
        className={inputClass}
      />
    </Field>
  );
}

function SwitchLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="link" className="text-muted-foreground hover:text-foreground h-11 self-start px-0 text-sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function PasswordForm({ next, onUseLink }: { next?: string; onUseLink: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, { status: "idle" });
  const error = state.status === "error" ? state.message : undefined;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <EmailField state={state} error={error} />
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "password-error" : undefined}
          className={inputClass}
        />
        {error && <FieldError id="password-error">{error}</FieldError>}
      </Field>
      <Button type="submit" className={primaryClass} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <SwitchLink onClick={onUseLink}>No password? Email me a sign-in link instead</SwitchLink>
    </form>
  );
}

function LinkForm({ next, onUsePassword }: { next?: string; onUsePassword: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="border-rule flex flex-col gap-3 border-t pt-6" role="status">
        <MailCheck className="text-primary size-6" aria-hidden />
        <h2 className="font-display text-2xl">Check your email</h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          We sent a sign-in link to <span className="text-foreground font-medium">{state.email}</span>. Open it on any
          device to get into the hub. It works for one hour.
        </p>
        <form action={action} className="mt-2">
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next ?? ""} />
          <Button type="submit" variant="link" className="h-11 px-0" disabled={pending}>
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
      <EmailField state={state} error={error} />
      {error ? (
        <FieldError id="email-error">{error}</FieldError>
      ) : (
        <FieldDescription id="email-hint">Use the email you signed up or paid with.</FieldDescription>
      )}
      <Button type="submit" className={primaryClass} disabled={pending}>
        {pending ? "Sending your link…" : "Email me a sign-in link"}
      </Button>
      <SwitchLink onClick={onUsePassword}>Sign in with a password instead</SwitchLink>
    </form>
  );
}
