import { DEV_USERS, canUseDevLogin, devLoginEnabled } from "@/lib/dev-login";
import { devSignIn } from "./dev-actions";

/** Renders nothing unless local dev login is on, or a valid demo key is in the URL. */
export function DevLoginPanel({ demoKey }: { demoKey?: string }) {
  if (!canUseDevLogin(demoKey)) return null;
  const isDemo = !devLoginEnabled();
  return (
    <section aria-labelledby="dev-login-h" className="border-warning/60 mt-10 rounded-xl border border-dashed p-4">
      <h2 id="dev-login-h" className="note text-[15px]">
        {isDemo ? "Demo · sign in as a test user" : "Dev only · sign in as"}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {DEV_USERS.map((u) => (
          <li key={u.email}>
            <form action={devSignIn}>
              <input type="hidden" name="email" value={u.email} />
              {isDemo && <input type="hidden" name="key" value={demoKey} />}
              <button
                type="submit"
                className="border-rule hover:border-foreground/30 bg-card flex min-h-12 w-full cursor-pointer flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors"
              >
                <span className="text-sm font-semibold">{u.label}</span>
                <span className="text-muted-foreground text-xs">{u.note}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
