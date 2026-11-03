import { describe, expect, it } from "vitest";
import { bodyToDraft, draftToBody, matchPeople, mentionQueryAt, stripMentions } from "./mentions";

const JON = { id: "00000000-0000-4000-a000-000000000004", name: "Jon (Support)" };
const JO = { id: "00000000-0000-4000-a000-000000000009", name: "Jo" };

describe("draftToBody", () => {
  it("turns picked @names into stored mentions", () => {
    expect(draftToBody("hey @Jon (Support), can you look?", [JON])).toBe(
      `hey @[Jon (Support)](user:${JON.id}), can you look?`,
    );
  });

  it("leaves names that weren't picked, and emails, alone", () => {
    expect(draftToBody("mail jo@example.com or @Sam", [JO])).toBe("mail jo@example.com or @Sam");
  });

  it("prefers the longest name and needs a word boundary", () => {
    expect(draftToBody("@Jon (Support) and @Jo and @Joanne", [JO, JON])).toBe(
      `@[Jon (Support)](user:${JON.id}) and @[Jo](user:${JO.id}) and @Joanne`,
    );
  });

  it("works at the start of a line", () => {
    expect(draftToBody("line one\n@Jo two", [JO])).toBe(`line one\n@[Jo](user:${JO.id}) two`);
  });
});

describe("bodyToDraft", () => {
  it("round-trips with draftToBody", () => {
    const body = `thanks @[Jon (Support)](user:${JON.id}) and @[Jo](user:${JO.id})!`;
    const { text, mentions } = bodyToDraft(body);
    expect(text).toBe("thanks @Jon (Support) and @Jo!");
    expect(mentions).toEqual([JON, JO]);
    expect(draftToBody(text, mentions)).toBe(body);
  });
});

describe("stripMentions", () => {
  it("shows plain names", () => {
    expect(stripMentions(`hi @[Jo](user:${JO.id})`)).toBe("hi @Jo");
  });
});

describe("mentionQueryAt", () => {
  it("finds the word being typed after @", () => {
    expect(mentionQueryAt("hello @jo", 9)).toEqual({ start: 6, query: "jo" });
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("ignores emails and finished words", () => {
    expect(mentionQueryAt("me@example", 10)).toBeNull();
    expect(mentionQueryAt("hi @jo there", 12)).toBeNull();
  });
});

describe("matchPeople", () => {
  const people = [{ display_name: "Sammi (Owner)" }, { display_name: "Jon (Support)" }, { display_name: "Bailey Jones" }];
  it("ranks name starts before later words", () => {
    expect(matchPeople(people, "jo").map((p) => p.display_name)).toEqual(["Jon (Support)", "Bailey Jones"]);
    expect(matchPeople(people, "own").map((p) => p.display_name)).toEqual(["Sammi (Owner)"]);
  });
});
