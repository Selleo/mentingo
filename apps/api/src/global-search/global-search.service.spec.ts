import {
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  GLOBAL_SEARCH_MODES,
  GLOBAL_SEARCH_SEMANTIC_STATUSES,
} from "@repo/shared";

import { GlobalSearchService } from "./global-search.service";

import type { GlobalSearchRepository } from "./global-search.repository";
import type { HybridSearchRepository } from "./hybrid-search.repository";
import type { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FileService } from "src/file/file.service";

describe("global search modes", () => {
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "test@example.test",
    permissions: [],
    roleSlugs: [],
  };
  const keyword = { findMatches: jest.fn().mockResolvedValue([]) };
  const hybrid = {
    findKeywordMatches: jest.fn().mockResolvedValue([]),
    findSemanticMatches: jest.fn().mockResolvedValue([]),
    hasCurrentChunks: jest.fn().mockResolvedValue(true),
  };
  const embeddings = { embedQuery: jest.fn().mockResolvedValue([1]) };
  const service = new GlobalSearchService(
    keyword as unknown as GlobalSearchRepository,
    {} as FileService,
    hybrid as unknown as HybridSearchRepository,
    embeddings as unknown as SemanticSearchEmbeddingService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    embeddings.embedQuery.mockResolvedValue([1]);
    hybrid.hasCurrentChunks.mockResolvedValue(true);
  });

  it("keeps keyword searches free of embedding calls", async () => {
    const response = await service.search("policy", SUPPORTED_LANGUAGES.EN, actor);
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(keyword.findMatches).not.toHaveBeenCalled();
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(6);
    expect(response.searchMode).toBe(GLOBAL_SEARCH_MODES.KEYWORD);
  });

  it("embeds once and retrieves both rankings in hybrid mode", async () => {
    const response = await service.search(
      "  handle difficult conversations  ",
      SUPPORTED_LANGUAGES.EN,
      actor,
      GLOBAL_SEARCH_MODES.HYBRID,
    );
    expect(embeddings.embedQuery).toHaveBeenCalledTimes(1);
    expect(embeddings.embedQuery).toHaveBeenCalledWith("handle difficult conversations");
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(6);
    expect(hybrid.findSemanticMatches).toHaveBeenCalledTimes(6);
    expect(response.semanticStatus).toBe(GLOBAL_SEARCH_SEMANTIC_STATUSES.READY);
  });

  it("falls back to lexical retrieval when the embedding provider fails", async () => {
    embeddings.embedQuery.mockRejectedValue(new Error("provider unavailable"));
    const response = await service.search(
      "policy",
      SUPPORTED_LANGUAGES.EN,
      actor,
      GLOBAL_SEARCH_MODES.HYBRID,
    );
    expect(response.semanticStatus).toBe(GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE);
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(6);
    expect(hybrid.findSemanticMatches).not.toHaveBeenCalled();
  });

  it("signals incomplete indexing while still using available vectors", async () => {
    hybrid.hasCurrentChunks.mockResolvedValue(false);
    const response = await service.search(
      "policy",
      SUPPORTED_LANGUAGES.EN,
      actor,
      GLOBAL_SEARCH_MODES.HYBRID,
    );
    expect(response.semanticStatus).toBe(GLOBAL_SEARCH_SEMANTIC_STATUSES.PENDING);
    expect(hybrid.findSemanticMatches).toHaveBeenCalledTimes(6);
  });

  it("uses the same file FTS candidates in keyword and hybrid modes", async () => {
    await service.search(
      "attachment text",
      SUPPORTED_LANGUAGES.EN,
      actor,
      GLOBAL_SEARCH_MODES.KEYWORD,
    );
    const keywordCalls = [...hybrid.findKeywordMatches.mock.calls];
    jest.clearAllMocks();
    await service.search(
      "attachment text",
      SUPPORTED_LANGUAGES.EN,
      actor,
      GLOBAL_SEARCH_MODES.HYBRID,
    );
    expect(hybrid.findKeywordMatches.mock.calls).toEqual(keywordCalls);
  });

  it("limits student search to content groups and course metadata sources", async () => {
    const getCourseRows = jest.fn().mockResolvedValue([]);
    Object.assign(keyword, { getCourseRows });
    const learner = {
      ...actor,
      permissions: [
        PERMISSIONS.COURSE_READ,
        PERMISSIONS.COURSE_READ_ASSIGNED,
        PERMISSIONS.CATEGORY_READ,
      ],
    };
    await service.search("course", SUPPORTED_LANGUAGES.EN, learner, GLOBAL_SEARCH_MODES.KEYWORD, {
      contentOnly: true,
      learnerOnly: true,
    });
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(4);
    expect(hybrid.findKeywordMatches).toHaveBeenCalledWith("course", "course", learner, true);
    expect(getCourseRows).toHaveBeenCalledWith([], SUPPORTED_LANGUAGES.EN, {
      enrolledStudentId: actor.userId,
      learnerVisibleOnly: true,
    });
  });

  it.each([GLOBAL_SEARCH_MODES.KEYWORD, GLOBAL_SEARCH_MODES.HYBRID])(
    "opts into learner-safe lesson retrieval in %s while retaining other content restrictions",
    async (mode) => {
      const getLearnerLessons = jest
        .fn()
        .mockResolvedValue([{ id: actor.userId, title: "Lesson", courseId: actor.tenantId }]);
      const getCourseRows = jest.fn().mockResolvedValue([]);
      Object.assign(keyword, { getLearnerLessons, getCourseRows });
      const learner = { ...actor, permissions: [PERMISSIONS.COURSE_READ_ASSIGNED] };
      const result = await service.search(
        "customer objections",
        SUPPORTED_LANGUAGES.EN,
        learner,
        mode,
        {
          contentOnly: true,
          learnerOnly: true,
          includeLearnerLessons: true,
        },
      );
      expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(5);
      expect(hybrid.findKeywordMatches).toHaveBeenCalledWith(
        "lesson",
        "customer objections",
        learner,
        false,
        true,
      );
      if (mode === GLOBAL_SEARCH_MODES.HYBRID)
        expect(hybrid.findSemanticMatches).toHaveBeenCalledWith(
          "lesson",
          [1],
          learner,
          false,
          true,
        );
      expect(getLearnerLessons).toHaveBeenCalledWith([], SUPPORTED_LANGUAGES.EN, learner);
      expect(result.lessons[0].id).toBe(actor.userId);
      expect(result.users).toEqual([]);
      expect(result.learningPaths).toEqual([]);
    },
  );
  it("exposes global relevance scores and attachment evidence across content types", async () => {
    hybrid.findKeywordMatches.mockImplementation(async (type) => {
      if (type === "lesson") return [{ entityId: actor.userId, rank: 0.1, languages: ["en"] }];
      if (type === "articles")
        return [
          {
            entityId: actor.tenantId,
            rank: 0.8,
            languages: ["en"],
            matchedPassage: "Policy text",
            matchedAttachmentFileName: "guide.pptx",
          },
        ];
      return [];
    });
    Object.assign(keyword, {
      getLessons: jest
        .fn()
        .mockResolvedValue([
          {
            id: actor.userId,
            title: "Lesson",
            courseId: actor.tenantId,
            matchedAttachmentFileName: "legacy.pdf",
          },
        ]),
      getArticles: jest.fn().mockResolvedValue([{ id: actor.tenantId, title: "Guide" }]),
    });
    const response = await service.search("policy", SUPPORTED_LANGUAGES.EN, {
      ...actor,
      permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.ARTICLE_READ_PUBLIC],
    });
    expect(response.articles[0].relevanceScore).toBeGreaterThan(
      response.lessons[0].relevanceScore!,
    );
    expect(response.lessons[0].matchedAttachmentFileName).toBe("legacy.pdf");
    expect(response.articles[0]).toMatchObject({
      matchedPassage: "Policy text",
      matchedAttachmentFileName: "guide.pptx",
    });
    hybrid.findKeywordMatches.mockResolvedValue([]);
  });

  it("does not call providers for a short query", async () => {
    await service.search("ab", SUPPORTED_LANGUAGES.EN, actor, GLOBAL_SEARCH_MODES.HYBRID);
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(hybrid.findKeywordMatches).not.toHaveBeenCalled();
  });
});
