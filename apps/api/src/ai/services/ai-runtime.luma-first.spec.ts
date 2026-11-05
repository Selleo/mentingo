import { AiCapability } from "@mentingo/luma-sdk";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";
import { FallbackLanguageModel } from "src/ai/utils/fallback-language-model";

import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { EnvService } from "src/env/services/env.service";

jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn(), loadOpenAiSdk: jest.fn() }));

const lumaChatModel = {
  provider: "luma",
  modelId: "luma-custom-profile",
  supportedUrls: {},
  doGenerate: jest.fn(),
  doStream: jest.fn(),
};
const openAiChatModel = {
  provider: "openai",
  modelId: "gpt",
  doGenerate: jest.fn(),
  doStream: jest.fn(),
};
const openAiEmbedding = { id: "openai-embedding" };

const createLumaProvider = jest.fn().mockReturnValue({
  chat: jest.fn().mockReturnValue(lumaChatModel),
});
const openAiProvider = Object.assign(jest.fn().mockReturnValue(openAiChatModel), {
  embedding: jest.fn().mockReturnValue(openAiEmbedding),
  embeddingModel: jest.fn().mockReturnValue(openAiEmbedding),
});
const embedMany = jest.fn();
const createEmbeddings = jest.fn();

const createService = (source: (typeof AI_RUNTIME_SOURCES)[keyof typeof AI_RUNTIME_SOURCES]) => {
  const service = new AiRuntimeService({
    getEnv: jest.fn().mockResolvedValue({ value: "luma-key" }),
  } as unknown as EnvService);
  jest.spyOn(service, "resolveSource").mockResolvedValue(source);
  jest.spyOn(service, "getAISdkOpenAI").mockResolvedValue(openAiProvider as never);
  Object.defineProperty(service, "getLumaClient", {
    configurable: true,
    value: jest.fn().mockResolvedValue({ ai: { createEmbeddings } }),
  });
  return service;
};

const embeddingRequest = {
  values: ["policy"],
  dimensions: 1536,
  coreModel: "text-embedding-3-small",
  timeoutMs: 3000,
};

describe("AiRuntimeService Luma-first paths", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    createLumaProvider.mockReturnValue({ chat: jest.fn().mockReturnValue(lumaChatModel) });
    openAiProvider.mockReturnValue(openAiChatModel);
    openAiProvider.embedding.mockReturnValue(openAiEmbedding);
    openAiProvider.embeddingModel.mockReturnValue(openAiEmbedding);
    process.env.LUMA_BASE_URL = "https://luma.internal/";
    jest.mocked(loadOpenAiSdk).mockResolvedValue({ createOpenAI: createLumaProvider } as never);
    jest.mocked(loadAiSdk).mockResolvedValue({ embedMany } as never);
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it("routes the Core assistant through Luma's OpenAI-compatible relay", async () => {
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    expect(model).toBeInstanceOf(FallbackLanguageModel);
    expect(createLumaProvider).toHaveBeenCalledWith({
      apiKey: "luma-key",
      baseURL: "https://luma.internal/api/public/v1/ai/openai",
      headers: { "X-API-Key": "luma-key" },
    });
  });

  it("runs an assistant step on OpenAI when the Luma call fails", async () => {
    const generated = { content: [] };
    lumaChatModel.doGenerate.mockRejectedValue(new Error("Luma 409 core_mode_not_executed"));
    openAiChatModel.doGenerate.mockResolvedValue(generated);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    await expect(model.doGenerate({ prompt: [] } as never)).resolves.toBe(generated);
    expect(openAiProvider).toHaveBeenCalledTimes(1);
  });

  it("does not retry an aborted assistant step on OpenAI", async () => {
    const abort = new AbortController();
    abort.abort();
    const cancellation = new Error("aborted");
    lumaChatModel.doStream.mockRejectedValue(cancellation);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    await expect(model.doStream({ prompt: [], abortSignal: abort.signal } as never)).rejects.toBe(
      cancellation,
    );
    expect(openAiChatModel.doStream).not.toHaveBeenCalled();
  });

  it("uses OpenAI directly for the assistant when Luma does not run chat", async () => {
    const model: LanguageModelV4 = await createService(
      AI_RUNTIME_SOURCES.CORE,
    ).getAssistantLanguageModel();

    expect(model).toBe(openAiChatModel);
    expect(createLumaProvider).not.toHaveBeenCalled();
  });

  it("reports the Luma profile model for search embeddings", async () => {
    createEmbeddings.mockResolvedValue({
      embeddings: [Array(1536).fill(0.1)],
      model: "Qwen/Qwen3-Embedding-4B",
    });

    await expect(
      createService(AI_RUNTIME_SOURCES.LUMA).createSemanticSearchEmbeddings(embeddingRequest),
    ).resolves.toEqual({
      embeddings: [Array(1536).fill(0.1)],
      model: "Qwen/Qwen3-Embedding-4B",
    });
    expect(createEmbeddings).toHaveBeenCalledWith({ texts: ["policy"], dimensions: 1536 });
    expect(createLumaProvider).not.toHaveBeenCalled();
    expect(embedMany).not.toHaveBeenCalled();
  });

  it.each([
    ["fails", () => createEmbeddings.mockRejectedValueOnce(new Error("Luma down"))],
    [
      "does not report its model",
      () => createEmbeddings.mockResolvedValueOnce({ embeddings: [Array(1536).fill(0.1)] }),
    ],
    [
      "returns another size",
      () =>
        createEmbeddings.mockResolvedValueOnce({
          embeddings: [Array(2560).fill(0.1)],
          model: "Qwen/Qwen3-Embedding-4B",
        }),
    ],
  ])("labels search vectors with the OpenAI model when Luma %s", async (_case, arrange) => {
    arrange();
    embedMany.mockResolvedValueOnce({ embeddings: [Array(1536).fill(0.2)] });

    await expect(
      createService(AI_RUNTIME_SOURCES.LUMA).createSemanticSearchEmbeddings(embeddingRequest),
    ).resolves.toEqual({ embeddings: [Array(1536).fill(0.2)], model: "text-embedding-3-small" });
    expect(embedMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: openAiEmbedding, maxRetries: 0 }),
    );
  });

  it("requests 1536-dimensional AI Mentor RAG embeddings from Luma", async () => {
    createEmbeddings.mockResolvedValue({
      embeddings: [Array(1536).fill(0.1)],
      model: "Qwen/Qwen3-Embedding-4B",
    });

    await expect(
      createService(AI_RUNTIME_SOURCES.LUMA).createEmbeddings(["policy"]),
    ).resolves.toEqual([Array(1536).fill(0.1)]);
    expect(createEmbeddings).toHaveBeenCalledWith({ texts: ["policy"], dimensions: 1536 });
  });

  it.each([
    ["returns a non-finite vector", [[Number.NaN, ...Array(1535).fill(0.1)]]],
    ["returns the wrong vector count", []],
  ])("falls back when the native SDK %s", async (_label, embeddings) => {
    createEmbeddings.mockResolvedValue({ embeddings, model: "local" });
    embedMany.mockResolvedValue({ embeddings: [Array(1536).fill(0.2)] });
    await expect(
      createService(AI_RUNTIME_SOURCES.LUMA).createSemanticSearchEmbeddings(embeddingRequest),
    ).resolves.toEqual({ embeddings: [Array(1536).fill(0.2)], model: "text-embedding-3-small" });
  });

  it("bounds a stalled SDK embedding read before using the Core fallback", async () => {
    jest.useFakeTimers();
    try {
      createEmbeddings.mockReturnValue(new Promise(() => undefined));
      embedMany.mockResolvedValue({ embeddings: [Array(1536).fill(0.2)] });
      const pending = createService(AI_RUNTIME_SOURCES.LUMA).createSemanticSearchEmbeddings(
        embeddingRequest,
      );
      await jest.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toEqual({
        embeddings: [Array(1536).fill(0.2)],
        model: "text-embedding-3-small",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps resolving through Luma configuration for the RAG capability", async () => {
    embedMany.mockResolvedValue({ embeddings: [Array(1536).fill(0.2)] });
    const service = createService(AI_RUNTIME_SOURCES.CORE);

    await expect(service.createEmbeddings(["policy"])).resolves.toEqual([Array(1536).fill(0.2)]);
    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiMentorRagEmbeddings);
    expect(createLumaProvider).not.toHaveBeenCalled();
  });
});
