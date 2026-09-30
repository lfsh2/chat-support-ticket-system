import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, toPlainText } from "./markdown";

describe("parseInline", () => {
  it("parses bold, italic and code", () => {
    expect(parseInline("**hi** *there* _you_ `x`")).toEqual([
      { type: "bold", children: [{ type: "text", text: "hi" }] },
      { type: "text", text: " " },
      { type: "italic", children: [{ type: "text", text: "there" }] },
      { type: "text", text: " " },
      { type: "italic", children: [{ type: "text", text: "you" }] },
      { type: "text", text: " " },
      { type: "code", text: "x" },
    ]);
  });

  it("leaves snake_case and multiplication alone", () => {
    expect(parseInline("my_file_name and 2 * 3 * 4")).toEqual([{ type: "text", text: "my_file_name and 2 * 3 * 4" }]);
  });

  it("auto-links URLs without trailing punctuation", () => {
    expect(parseInline("see https://example.com/a?b=1.")).toEqual([
      { type: "text", text: "see " },
      { type: "link", href: "https://example.com/a?b=1", children: [{ type: "text", text: "https://example.com/a?b=1" }] },
      { type: "text", text: "." },
    ]);
  });

  it("only allows safe link protocols", () => {
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ type: "text", text: "[click](javascript:alert(1))" }]);
    expect(parseInline("[mail](mailto:a@b.co)")[0]).toMatchObject({ type: "link", href: "mailto:a@b.co" });
  });

  it("keeps HTML as literal text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ type: "text", text: "<img src=x onerror=alert(1)>" }]);
  });

  it("parses mentions", () => {
    const id = "00000000-0000-4000-a000-000000000001";
    expect(parseInline(`hey @[Casey](user:${id})!`)).toEqual([
      { type: "text", text: "hey " },
      { type: "mention", userId: id, name: "Casey" },
      { type: "text", text: "!" },
    ]);
  });

  it("turns newlines into line breaks", () => {
    expect(parseInline("a\nb")).toEqual([{ type: "text", text: "a" }, { type: "br" }, { type: "text", text: "b" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits paragraphs, lists and code blocks", () => {
    const blocks = parseMarkdown("Steps:\n- one\n- two\n\n1. first\n2. second\n\n```\nconst a = 1\n```");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "list", "codeblock"]);
    expect(blocks[1]).toMatchObject({ ordered: false, items: [[{ text: "one" }], [{ text: "two" }]] });
    expect(blocks[2]).toMatchObject({ ordered: true });
    expect(blocks[3]).toEqual({ type: "codeblock", text: "const a = 1" });
  });

  it("does not parse markdown inside code blocks", () => {
    expect(parseMarkdown("```\n**not bold**\n```")).toEqual([{ type: "codeblock", text: "**not bold**" }]);
  });
});

describe("toPlainText", () => {
  it("strips formatting and mention syntax", () => {
    expect(toPlainText("**Hi** @[Casey](user:00000000-0000-4000-a000-000000000001), see [docs](https://x.co)")).toBe(
      "Hi @Casey, see docs",
    );
  });
});
