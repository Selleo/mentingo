import { loadAiSdk } from "src/ai/utils/ai-esm";

import { SEMANTIC_SEARCH_MODEL } from "./semantic-search-index.constants";
import { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";

jest.mock("src/ai/services/ai-runtime.service", () => ({ AiRuntimeService: class {} }));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

describe("pinned semantic search embeddings", () => {
  const embedMany = jest.fn();
  const model = {};
  const embedding = jest.fn().mockReturnValue(model);
  const runtime = { getAISdkOpenAI: jest.fn().mockResolvedValue({ embedding }) };
  const service = new SemanticSearchEmbeddingService(runtime as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadAiSdk).mockResolvedValue({ embedMany } as never);
  });

  it("always uses the pinned model and returns complete vectors", async () => {
    embedMany.mockResolvedValue({ embeddings: [Array(1536).fill(0.1)] });
    expect(await service.embedQuery("expenses policy")).toHaveLength(1536);
    expect(embedding).toHaveBeenCalledWith(SEMANTIC_SEARCH_MODEL);
    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["expenses policy"],
        telemetry: { isEnabled: false },
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
      }),
    );
  });

  it("disables telemetry for background indexing batches", async () => {
    const texts = ["first chunk", "second chunk"];
    embedMany.mockResolvedValue({ embeddings: texts.map(() => Array(1536).fill(0.1)) });

    expect(await service.embedTexts(texts)).toHaveLength(2);
    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({ values: texts, telemetry: { isEnabled: false } }),
    );
  });

  it.each([
    { embeddings: [] },
    { embeddings: [[0.1]] },
    { embeddings: [Array(1536).fill(Number.NaN)] },
  ])("rejects incomplete or nonfinite responses", async ({ embeddings }) => {
    embedMany.mockResolvedValue({ embeddings });
    await expect(service.embedQuery("policy")).rejects.toThrow(
      "Invalid semantic search embedding response",
    );
  });

  it("propagates provider failure without switching embedding spaces", async () => {
    embedMany.mockRejectedValue(new Error("unavailable"));
    await expect(service.embedQuery("policy")).rejects.toThrow("unavailable");
    expect(embedMany).toHaveBeenCalledTimes(1);
  });
});
