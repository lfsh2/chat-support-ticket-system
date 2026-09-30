/**
 * Markdown-lite (§5.2): bold, italic, inline code, code blocks, links, lists, @mentions.
 * Produces a small AST that React renders as elements — never raw HTML — so message
 * content can't inject markup. Only http(s) and mailto links are allowed.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "mention"; userId: string; name: string }
  | { type: "br" };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "codeblock"; text: string }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const INLINE =
  /`(?<code>[^`\n]+)`|@\[(?<mname>[^\]\n]{1,80})\]\(user:(?<mid>[0-9a-f-]{36})\)|\[(?<ltext>[^\]\n]+)\]\((?<lhref>(?:https?:\/\/|mailto:)[^\s)]+)\)|(?<url>https?:\/\/[^\s<]*[^\s<.,:;"')\]!?])|\*\*(?<bold>(?:(?!\*\*).)+)\*\*|(?<![\w*])\*(?<ital>[^\s*](?:[^*\n]*[^\s*])?)\*(?![\w*])|(?<![\w_])_(?<ital2>[^\s_](?:[^_\n]*[^\s_])?)_(?![\w_])/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (!text) return;
    const parts = text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) out.push({ type: "br" });
      if (!p) return;
      const prev = out[out.length - 1];
      if (prev?.type === "text") prev.text += p;
      else out.push({ type: "text", text: p });
    });
  };

  while ((m = re.exec(src))) {
    pushText(src.slice(last, m.index));
    const g = m.groups!;
    if (g.code != null) out.push({ type: "code", text: g.code });
    else if (g.mid != null) out.push({ type: "mention", userId: g.mid, name: g.mname });
    else if (g.lhref != null) out.push({ type: "link", href: g.lhref, children: parseInline(g.ltext) });
    else if (g.url != null) out.push({ type: "link", href: g.url, children: [{ type: "text", text: g.url }] });
    else if (g.bold != null) out.push({ type: "bold", children: parseInline(g.bold) });
    else if (g.ital != null || g.ital2 != null) out.push({ type: "italic", children: parseInline(g.ital ?? g.ital2) });
    last = m.index + m[0].length;
  }
  pushText(src.slice(last));
  return out;
}

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join("\n")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i++]);
      blocks.push({ type: "codeblock", text: code.join("\n") });
      continue;
    }

    const ul = UL.exec(line);
    const ol = ul ? null : OL.exec(line);
    if (ul || ol) {
      flush();
      const ordered = Boolean(ol);
      const pattern = ordered ? OL : UL;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item) break;
        items.push(parseInline(item[1]));
        i++;
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") flush();
    else para.push(line);
  }
  flush();
  return blocks;
}

/** Plain-text version (for previews, notifications and screen-reader labels). */
export function toPlainText(src: string): string {
  return src
    .replace(/@\[([^\]\n]+)\]\(user:[0-9a-f-]{36}\)/g, "@$1")
    .replace(/\[([^\]\n]+)\]\([^)]+\)/g, "$1")
    .replace(/```/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
