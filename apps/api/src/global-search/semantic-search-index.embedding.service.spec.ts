import { getDefaultSemanticSearchEmbeddingIdentity } from "./semantic-search-index.config";
import { SEMANTIC_SEARCH_MODEL } from "./semantic-search-index.constants";
import { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";

jest.mock("src/ai/services/ai-runtime.service", () => ({ AiRuntimeService: class {} }));

const originalEnv = { ...process.env };
const resetEnv = () => {
  process.env = { ...originalEnv };
  delete process.env.SEMANTIC_SEARCH_EMBEDDING_MODEL;
};

describe("semantic search embeddings", () => {
  const createSemanticSearchEmbeddings = jest.fn();
  const service = new SemanticSearchEmbeddingService({
    createSemanticSearchEmbeddings,
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    resetEnv();
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it("requests the configured size with the OpenAI fallback model", async () => {
    createSemanticSearchEmbeddings.mockResolvedValue({
      embeddings: [Array(1536).fill(0.1)],
      model: SEMANTIC_SEARCH_MODEL,
    });

    const result = await service.embedQuery("expenses policy");

    expect(result.embedding).toHaveLength(1536);
    expect(createSemanticSearchEmbeddings).toHaveBeenCalledWith({
      values: ["expenses policy"],
      dimensions: 1536,
      coreModel: SEMANTIC_SEARCH_MODEL,
      timeoutMs: 3000,
    });
  });

  it("labels vectors with the model that actually produced them", async () => {
    createSemanticSearchEmbeddings.mockResolvedValue({
      embeddings: [Array(1536).fill(0.1)],
      model: "Qwen/Qwen3-Embedding-4B",
    });

    await expect(service.embedTexts(["policy"])).resolves.toEqual({
      embeddings: [Array(1536).fill(0.1)],
      identity: { model: "Qwen/Qwen3-Embedding-4B" },
    });
  });

  it.each([
    { embeddings: [] },
    { embeddings: [[0.1]] },
    { embeddings: [Array(1536).fill(Number.NaN)] },
  ])("rejects incomplete or nonfinite responses", async ({ embeddings }) => {
    createSemanticSearchEmbeddings.mockResolvedValue({ embeddings, model: SEMANTIC_SEARCH_MODEL });
    await expect(service.embedQuery("policy")).rejects.toThrow(
      "Invalid semantic search embedding response",
    );
  });

  it("propagates a failure after Luma and the fallback both fail", async () => {
    createSemanticSearchEmbeddings.mockRejectedValue(new Error("unavailable"));
    await expect(service.embedQuery("policy")).rejects.toThrow("unavailable");
  });
});

describe("semantic search embedding configuration", () => {
  beforeEach(resetEnv);

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it("keeps the existing OpenAI space by default", () => {
    expect(getDefaultSemanticSearchEmbeddingIdentity()).toEqual({ model: SEMANTIC_SEARCH_MODEL });
  });

  it("uses the preferred model when one is configured", () => {
    process.env.SEMANTIC_SEARCH_EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-4B";
    expect(getDefaultSemanticSearchEmbeddingIdentity().model).toBe("Qwen/Qwen3-Embedding-4B");
  });
});
