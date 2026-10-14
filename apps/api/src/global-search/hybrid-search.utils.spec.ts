import { fuseSearchMatches } from "./hybrid-search.utils";

import type { MatchRow } from "./global-search.types";

const match = (entityId: string, rank: number, language: "en" | "pl" = "en"): MatchRow => ({
  entityId: entityId as MatchRow["entityId"],
  languages: [language],
  rank,
});

describe("hybrid rank fusion", () => {
  it("rewards agreement without comparing incompatible raw scores", () => {
    const fused = fuseSearchMatches([match("a", 999), match("b", 1)], [match("b", 0.9)]);
    expect(fused.map((row) => row.entityId)).toEqual(["b", "a"]);
  });

  it("does not let repeated chunks multiply an entity's score", () => {
    const fused = fuseSearchMatches([match("a", 1), match("a", 1), match("b", 1)], []);
    expect(fused).toHaveLength(2);
    expect(fused[0].rank).toBeCloseTo(1 / 61);
    expect(fused[1].rank).toBeCloseTo(1 / 62);
  });

  it("keeps lexical-only and semantic-only results and matching languages", () => {
    const fused = fuseSearchMatches([match("a", 1)], [match("a", 0.9, "pl"), match("b", 0.8)]);
    expect(fused[0].languages).toEqual(["en", "pl"]);
    expect(fused[1].entityId).toBe("b");
  });

  it("retains the lexical evidence passage and its corresponding filename", () => {
    const fused = fuseSearchMatches(
      [
        {
          ...match("a", 1),
          matchedPassage: "Exact policy",
          matchedAttachmentFileName: "policy.pdf",
        },
      ],
      [
        {
          ...match("a", 0.9),
          matchedPassage: "Related handbook",
          matchedAttachmentFileName: "handbook.pdf",
        },
      ],
    );
    expect(fused[0]).toMatchObject({
      matchedPassage: "Exact policy",
      matchedAttachmentFileName: "policy.pdf",
    });
  });

  it("does not attach a semantic filename to a lexical passage from another source", () => {
    const fused = fuseSearchMatches(
      [{ ...match("a", 1), matchedPassage: "Article body", matchedAttachmentFileName: null }],
      [{ ...match("a", 0.9), matchedPassage: "File text", matchedAttachmentFileName: "guide.pdf" }],
    );
    expect(fused[0].matchedAttachmentFileName).toBeNull();
  });
});
