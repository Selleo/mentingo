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

describe("Product guidance source boundary", () => {
  const origin = "https://tenant.example";
  const guidance = {
    tutorialKey: "course-authoring.edit",
    chapterId: "add-lesson",
    entityType: "helpdesk",
    guidanceKind: "product_guidance",
    title: "Add a lesson",
    description: "Product guidance only.",
    url: `${origin}/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson`,
  };
  it("grounds exact help links without treating product guidance as tenant lesson evidence", () => {
    const sources = collectAssistantSources(guidance, origin, "get_helpdesk_tutorial");
    expect(sources).toEqual([
      {
        title: guidance.title,
        description: guidance.description,
        entityType: "helpdesk",
        url: guidance.url,
      },
    ]);
    expect(groundAssistantText(`See [Add a lesson](${guidance.url})`, sources)).toContain(
      `](${guidance.url})`,
    );
    expect(
      hasAssistantReadableContent("get_helpdesk_tutorial", {
        tutorial: { ...guidance, description: "Full product tutorial" },
      }),
    ).toBe(false);
    expect(
      hasAssistantReadableContent("get_lesson", { lesson: { content: "Tenant lesson text" } }),
    ).toBe(true);
  });
  it.each([
    { guidanceKind: "lesson_content" },
    { tutorialKey: "another-key" },
    { chapterId: "another-chapter" },
    { url: `${guidance.url}&chapter=add-lesson` },
    { url: `${guidance.url}&target=admin` },
    { url: `${guidance.url}#invented` },
    { url: "https://other.example/helpdesk/tutorials/course-authoring.edit?chapter=add-lesson" },
    { url: "https://vz-public.b-cdn.net/video/playlist.m3u8" },
  ])(
    "rejects arbitrary help, duplicate/query-mutated, external and media references %#",
    (change) => {
      expect(
        collectAssistantSources({ ...guidance, ...change }, origin, "search_helpdesk"),
      ).toEqual([]);
    },
  );
  it("does not promote product-looking data from an unrelated or unspecified tool", () => {
    expect(collectAssistantSources(guidance, origin)).toEqual([]);
    expect(collectAssistantSources(guidance, origin, "get_lesson")).toEqual([]);
    expect(collectAssistantSources(guidance, origin, "invented_helpdesk_tool")).toEqual([]);
  });
  it("does not infer a verified help source from its URL alone", () => {
    expect(collectAssistantSources({ title: guidance.title, url: guidance.url }, origin)).toEqual(
      [],
    );
    expect(groundAssistantText(`[Invented](${guidance.url})`, [])).toBe("Invented");
  });
});
