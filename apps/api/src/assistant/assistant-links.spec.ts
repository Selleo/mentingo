import {
  collectAssistantSources,
  groundAssistantText,
  hasAssistantReadableContent,
  selectAssistantSources,
} from "./assistant-links";

describe("Assistant grounding", () => {
  const origin = "https://tenant.example";
  const source = {
    title: "Safety course",
    url: `${origin}/course/123`,
    entityType: "course" as const,
  };

  it("retains only canonical tool-returned tenant destinations", () => {
    expect(
      collectAssistantSources(
        {
          courses: [{ ...source, id: "123" }],
          other: [
            { id: "actual-id", title: "Spoofed", url: `${origin}/course/not-the-returned-record` },
            { id: "123", title: "Foreign", url: "https://other.example/course/123" },
            { id: "123", title: "File", url: `${origin}/api/files/private?token=secret` },
            {
              id: "123",
              title: "Credentials",
              url: "https://user:password@tenant.example/course/123",
            },
          ],
          content: `<a href="${origin}/course/unreturned">link</a>`,
        },
        origin,
      ),
    ).toEqual([source]);
  });

  it("removes invented URLs, HTML links, and inline external links while preserving verified links", () => {
    const output = groundAssistantText(
      `[Safety](${source.url}) [invented](${origin}/course/fake) https://external.example <a href="https://bad.example">bad</a>`,
      [source],
    );
    expect(output).toBe(`[Safety](${source.url}) invented [unverified link omitted] bad`);
    expect(output).not.toContain("fake");
  });

  it("links only exact unambiguous returned names outside links and code and shows only cited sources", () => {
    const other = { title: "Unrelated course", url: `${origin}/course/other` };
    const person = { title: "Ada Nowak", url: `${origin}/admin/users/ada` };
    const text = groundAssistantText(
      "Safety course and Ada Nowak. `Safety course` [existing](https://tenant.example/course/123)",
      [source, other, person],
    );
    expect(text).toBe(
      `[Safety course](${source.url}) and [Ada Nowak](${person.url}). ` +
        "`Safety course` " +
        `[existing](${source.url})`,
    );
    expect(selectAssistantSources(text, [source, other, person])).toEqual([source, person]);
    expect(groundAssistantText("Safety courses are different", [source])).toBe(
      "Safety courses are different",
    );
    expect(
      groundAssistantText("Safety course", [
        source,
        { ...source, url: `${origin}/course/duplicate` },
      ]),
    ).toBe("Safety course");
    expect(groundAssistantText("Safety course", [])).toBe("Safety course");
  });

  it("retains safe concise preview text and rejects malformed entity destinations", () => {
    expect(
      collectAssistantSources(
        { id: "123", ...source, description: "<p>Helpful course description</p>" },
        origin,
      ),
    ).toEqual([{ ...source, description: "Helpful course description" }]);
    expect(
      collectAssistantSources(
        { id: "123", title: "Fake", url: `${origin}/course/other/123` },
        origin,
      ),
    ).toEqual([]);
  });

  it("distinguishes retrieved lesson metadata from readable authored content", () => {
    expect(
      hasAssistantReadableContent("get_lesson", {
        lesson: { title: "Quiz", content: "", contentReadSupported: false },
      }),
    ).toBe(false);
    expect(
      hasAssistantReadableContent("get_lesson", {
        lesson: { title: "Safety", content: "Wear a helmet", contentReadSupported: true },
      }),
    ).toBe(true);
    expect(
      hasAssistantReadableContent("list_lessons", { lessons: [{ description: "Metadata" }] }),
    ).toBe(false);
  });

  it("does not promote a model supplied source to a verified destination", () => {
    expect(groundAssistantText("[fake](https://tenant.example/news/fake)", [])).toBe("fake");
  });
});
