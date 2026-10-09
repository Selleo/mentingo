import { describe, expect, it } from "vitest";

import {
  compactLinkSeparators,
  extractTrailingSources,
  safeHttpUrl,
  parseFetchedResearchSources,
  sourceDomain,
} from "./authoringSources";

describe("extractTrailingSources", () => {
  it("removes a trailing sources list and its heading", () => {
    const result = extractTrailingSources(
      [
        "Here is the summary.",
        "",
        "**Sources:**",
        "1. [Onboarding guide](https://docs.example.com/onboarding) — official docs",
        "2. <https://www.example.com/blog/start>",
      ].join("\n"),
    );

    expect(result.text).toBe("Here is the summary.");
    expect(result.sources).toEqual([
      { url: "https://docs.example.com/onboarding", label: "Onboarding guide" },
      { url: "https://www.example.com/blog/start", label: null },
    ]);
  });

  it("keeps a descriptive intro line that is not a sources heading", () => {
    const result = extractTrailingSources(
      ["Here's what I found:", "- https://example.com/a", "- https://example.com/a"].join("\n"),
    );

    expect(result.text).toBe("Here's what I found:");
    expect(result.sources).toEqual([{ url: "https://example.com/a", label: null }]);
  });

  it("leaves lists with prose or non-http links untouched", () => {
    const text = [
      "Steps:",
      "- Open [the course](https://example.com/course) and review every lesson carefully before you publish it to learners.",
      "- [Mail us](mailto:team@example.com)",
    ].join("\n");

    expect(extractTrailingSources(text)).toEqual({ text, sources: [] });
  });
});

describe("source URL helpers", () => {
  it("accepts only http(s) URLs", () => {
    expect(safeHttpUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });

  it("drops www from the chip domain", () => {
    expect(sourceDomain("https://www.example.com/a")).toBe("example.com");
  });
});

describe("compactLinkSeparators", () => {
  it("removes commas and conjunctions between adjacent links only", () => {
    expect(
      compactLinkSeparators(
        "Sources: [a](https://a.com), [b](https://b.com) and [c](https://c.com), then more.",
      ),
    ).toBe("Sources: [a](https://a.com) [b](https://b.com) [c](https://c.com), then more.");
  });
});

describe("parseFetchedResearchSources", () => {
  it("keeps fetched page metadata, deduplicates normalized URLs and rejects unsafe sources", () => {
    expect(
      parseFetchedResearchSources([
        { url: "https://example.com", title: "  Docs  " },
        { url: "https://example.com/", title: "Duplicate" },
        { url: "javascript:alert(1)", title: "Script" },
        { url: "https://secret@example.com/", title: "Credentials" },
        { url: "https://example.org/manual", title: 42 },
        { title: "No URL" },
        null,
      ]),
    ).toEqual([
      { url: "https://example.com/", title: "Docs" },
      { url: "https://example.org/manual", title: null },
    ]);
    expect(parseFetchedResearchSources({ sources: [] })).toEqual([]);
  });
});
