/**
 * Editorial empty state: a serif line and a plain next step, set on the page
 * like a note — not an icon in a rounded tile floating in the middle.
 */
export function EmptyState({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pt-12 pb-10 md:px-10 md:pt-20">
      <div className="max-w-md">
        {eyebrow && <p className="note text-muted-foreground text-[15px]">{eyebrow}</p>}
        <h2 className="font-display mt-1 text-[30px] leading-[1.1] tracking-tight md:text-[36px]">{title}</h2>
        {children && <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">{children}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
