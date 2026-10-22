import { fuseSearchMatches, rankContentMatches } from "./hybrid-search.utils";

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

describe("global content ranking", () => {
  const content = (entityId: string, rank: number, entityType: "lesson" | "articles") => ({
    ...match(entityId, rank),
    entityType,
  });

  it("ranks an attachment-backed article above a weaker lesson without a type priority", () => {
    const ranked = rankContentMatches(
      [
        content("lesson", 0.1, "lesson"),
        {
          ...content("articles", 0.8, "articles"),
          matchedAttachmentFileName: "guide.pptx",
          matchedPassage: "Policy details",
        },
      ],
      [],
    );
    expect(ranked.map((row) => row.entityId)).toEqual(["articles", "lesson"]);
    expect(ranked[0].rank).toBeGreaterThan(ranked[1].rank);
    expect(ranked[0].matchedAttachmentFileName).toBe("guide.pptx");
  });

  it("uses globally comparable vector ranks and preserves identities shared across types", () => {
    const ranked = rankContentMatches(
      [],
      [content("shared", 0.6, "lesson"), content("shared", 0.9, "articles")],
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0].entityType).toBe("articles");
    expect(ranked[0].rank).toBeGreaterThan(ranked[1].rank);
  });

  it("excludes weak vectors before fusion while preserving their valid keyword matches", () => {
    const ranked = rankContentMatches(
      [content("exact", 0.1, "lesson")],
      [
        content("exact", 0.4, "lesson"),
        content("irrelevant", 0.54, "articles"),
        content("related", 0.55, "articles"),
      ],
    );
    expect(ranked.map((row) => row.entityId).sort()).toEqual(["exact", "related"]);
    expect(ranked.find((row) => row.entityId === "exact")?.rank).toBeCloseTo(1 / 61);
  });

  it("uses deterministic identity tie breaks independent of type request order", () => {
    const keyword = [content("z", 1, "lesson"), content("a", 1, "articles")];
    expect(rankContentMatches(keyword, [])).toEqual(rankContentMatches([...keyword].reverse(), []));
  });
});
