import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "br":
        return <br key={i} />;
      case "bold":
        return (
          <strong key={i} className="font-semibold">
            <InlineNodes nodes={n.children} />
          </strong>
        );
      case "italic":
        return (
          <em key={i}>
            <InlineNodes nodes={n.children} />
          </em>
        );
      case "code":
        return (
          <code key={i} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
            {n.text}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer ugc"
            className="text-primary break-words underline underline-offset-2"
          >
            <InlineNodes nodes={n.children} />
          </a>
        );
      case "mention":
        return (
          <span key={i} className="bg-primary/10 text-primary rounded px-1 font-medium">
            @{n.name}
          </span>
        );
    }
  });
}

/** Renders markdown-lite as React elements (no HTML injection possible). */
export function MessageBody({ body }: { body: string }) {
  const blocks = parseMarkdown(body);
  return (
    <div className="space-y-1.5 text-[15px] leading-normal break-words [overflow-wrap:anywhere]">
      {blocks.map((b, i) => {
        if (b.type === "codeblock")
          return (
            <pre key={i} className="bg-muted overflow-x-auto rounded-lg px-3 py-2 font-mono text-[13px] leading-relaxed">
              <code>{b.text}</code>
            </pre>
          );
        if (b.type === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={i} className={b.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <InlineNodes nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            <InlineNodes nodes={b.children} />
          </p>
        );
      })}
    </div>
  );
}
