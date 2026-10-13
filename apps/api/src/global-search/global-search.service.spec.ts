import { SUPPORTED_LANGUAGES } from "@repo/shared";

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
    expect(keyword.findMatches).toHaveBeenCalledTimes(6);
    expect(response.searchMode).toBe("keyword");
  });

  it("embeds once and retrieves both rankings in hybrid mode", async () => {
    const response = await service.search(
      "  handle difficult conversations  ",
      SUPPORTED_LANGUAGES.EN,
      actor,
      "hybrid",
    );
    expect(embeddings.embedQuery).toHaveBeenCalledTimes(1);
    expect(embeddings.embedQuery).toHaveBeenCalledWith("handle difficult conversations");
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(6);
    expect(hybrid.findSemanticMatches).toHaveBeenCalledTimes(6);
    expect(response.semanticStatus).toBe("ready");
  });

  it("falls back to lexical retrieval when the embedding provider fails", async () => {
    embeddings.embedQuery.mockRejectedValue(new Error("provider unavailable"));
    const response = await service.search("policy", SUPPORTED_LANGUAGES.EN, actor, "hybrid");
    expect(response.semanticStatus).toBe("unavailable");
    expect(hybrid.findKeywordMatches).toHaveBeenCalledTimes(6);
    expect(hybrid.findSemanticMatches).not.toHaveBeenCalled();
  });

  it("signals incomplete indexing while still using available vectors", async () => {
    hybrid.hasCurrentChunks.mockResolvedValue(false);
    const response = await service.search("policy", SUPPORTED_LANGUAGES.EN, actor, "hybrid");
    expect(response.semanticStatus).toBe("pending");
    expect(hybrid.findSemanticMatches).toHaveBeenCalledTimes(6);
  });

  it("does not call providers for a short query", async () => {
    await service.search("ab", SUPPORTED_LANGUAGES.EN, actor, "hybrid");
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(hybrid.findKeywordMatches).not.toHaveBeenCalled();
  });
});
