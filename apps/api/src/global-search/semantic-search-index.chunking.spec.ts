import { chunkSearchText, normalizeSearchText } from "./semantic-search-index.chunking";

describe("semantic search chunking", () => {
  it("indexes readable rich text and preserves policy details", () => {
    expect(normalizeSearchText("<h2>Expenses</h2><p>Submit within 30 days.</p>")).toContain(
      "Submit within 30 days.",
    );
    expect(
      normalizeSearchText(
        JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Policy clause" }] }],
        }),
      ),
    ).toBe("Policy clause");
  });

  it("covers the entire source with bounded overlapping chunks", () => {
    const text = Array.from({ length: 1600 }, (_, i) => `clause${i}`).join(" ");
    const chunks = chunkSearchText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2400)).toBe(true);
    for (let i = 0; i < 1600; i++)
      expect(chunks.some((chunk) => chunk.includes(`clause${i}`))).toBe(true);
    expect(chunks[1]).toContain(chunks[0].slice(-200));
  });

  it("rejects excessive extracted text instead of silently truncating", () => {
    expect(() => chunkSearchText("a".repeat(1_000_001))).toThrow("indexing limit");
    expect(chunkSearchText(" \u0000 ")).toEqual([]);
  });
});
