import { ORG_NAME, PROGRAMS, SUPPORT_EMAIL } from "@/lib/config";
import { Wordmark } from "@/components/shell/wordmark";

/**
 * Sign-in / access screens. Midnight panel carries the voice (serif statement);
 * the paper side carries the task. Stacks on phones with the panel as a short band.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-none">
      <section className="bg-sidebar text-sidebar-foreground relative flex flex-col gap-8 overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-7 md:justify-between md:gap-10 md:px-12 md:py-12">
        <Wordmark className="text-white" />
        <div className="max-w-md">
          <p className="font-display text-[30px] leading-[1.1] tracking-tight text-white md:text-[44px]">
            Ask the team.
            <br />
            Share a win.
            <br />
            <span className="note text-sidebar-foreground/80">Find an answer.</span>
          </p>
          <ul className="mt-8 hidden gap-6 text-sm md:flex">
            {Object.values(PROGRAMS).map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className="h-3.5 w-[3px] rounded-full" style={{ background: p.accent }} aria-hidden />
                {p.label} clients
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sidebar-foreground/60 hidden text-xs md:block">
          {ORG_NAME} · Questions about access? <a className="underline underline-offset-2 hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>

      <section className="paper flex flex-col px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:justify-center md:px-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-[28px] leading-tight tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2 mb-8 text-[15px] leading-relaxed">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
