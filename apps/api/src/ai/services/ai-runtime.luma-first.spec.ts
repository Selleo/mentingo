import { AiCapability } from "@mentingo/luma-sdk";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";
import { FallbackLanguageModel } from "src/ai/utils/fallback-language-model";

import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { EnvService } from "src/env/services/env.service";

jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn(), loadOpenAiSdk: jest.fn() }));

const nativeGenerateChat = jest.fn();
const nativeStreamChat = jest.fn();
const openAiChatModel = {
  provider: "openai",
  modelId: "gpt",
  doGenerate: jest.fn(),
  doStream: jest.fn(),
};
const openAiEmbedding = { id: "openai-embedding" };

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
    value: jest.fn().mockResolvedValue({
      ai: { createEmbeddings },
      mentor: { generateChat: nativeGenerateChat, streamChat: nativeStreamChat },
    }),
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
    openAiProvider.mockReturnValue(openAiChatModel);
    openAiProvider.embedding.mockReturnValue(openAiEmbedding);
    openAiProvider.embeddingModel.mockReturnValue(openAiEmbedding);
    process.env.LUMA_BASE_URL = "https://luma.internal/";
    jest.mocked(loadAiSdk).mockResolvedValue({ embedMany } as never);
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it("routes the Core assistant through the existing native Mentor SDK", async () => {
    nativeGenerateChat.mockResolvedValue({
      message: "Native answer",
      toolCalls: [],
      finishReason: "stop",
    });
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();
    expect(model).toBeInstanceOf(FallbackLanguageModel);
    await expect(
      model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }] }),
    ).resolves.toMatchObject({ content: [{ type: "text", text: "Native answer" }] });
    expect(nativeGenerateChat).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Hello" }],
      streamFormat: "events",
    });
    expect(loadOpenAiSdk).not.toHaveBeenCalled();
  });

  it("runs an assistant step on OpenAI when the Luma call fails", async () => {
    const generated = { content: [] };
    nativeGenerateChat.mockRejectedValue(new Error("Luma 409 core_mode_not_executed"));
    openAiChatModel.doGenerate.mockResolvedValue(generated);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    await expect(model.doGenerate({ prompt: [] } as never)).resolves.toBe(generated);
    expect(openAiProvider).toHaveBeenCalledTimes(1);
  });

  it("does not retry an aborted assistant step on OpenAI", async () => {
    const abort = new AbortController();
    const cancellation = new Error("aborted");
    abort.abort(cancellation);
    nativeStreamChat.mockRejectedValue(cancellation);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    await expect(model.doStream({ prompt: [], abortSignal: abort.signal } as never)).rejects.toBe(
      cancellation,
    );
    expect(openAiChatModel.doStream).not.toHaveBeenCalled();
  });

  it("preserves tool-call options when the assistant stream fails before opening", async () => {
    const streamed = { stream: new ReadableStream() };
    const options = {
      prompt: [],
      tools: [{ type: "function", name: "read_course", inputSchema: {} }],
      toolChoice: { type: "required" },
    };
    nativeStreamChat.mockRejectedValue(new Error("Luma unavailable"));
    openAiChatModel.doStream.mockResolvedValue(streamed);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();

    await expect(model.doStream(options as never)).resolves.toBe(streamed);
    expect(nativeStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        streamFormat: "events",
        tools: [{ name: "read_course", inputSchema: {} }],
        toolChoice: "required",
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(openAiChatModel.doStream).toHaveBeenCalledWith(options);
  });

  it.each([
    "Legacy plain text",
    JSON.stringify({ type: "error", code: "provider_request_failed" }) + "\n",
  ])("uses existing Core fallback for incompatible native startup output (%s)", async (body) => {
    async function* response() {
      yield Buffer.from(body);
    }
    nativeStreamChat.mockResolvedValue({ data: response() });
    const streamed = { stream: new ReadableStream() };
    openAiChatModel.doStream.mockResolvedValue(streamed);
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();
    await expect(model.doStream({ prompt: [] })).resolves.toBe(streamed);
    expect(openAiChatModel.doStream).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a tool-capable assistant call after its stream has opened", async () => {
    const failure = new Error("upstream connection interrupted");
    async function* failedStream() {
      yield Buffer.from(JSON.stringify({ type: "text-delta", text: "Already emitted" }) + "\n");
      throw failure;
    }
    nativeStreamChat.mockResolvedValue({ data: failedStream() });
    const model = await createService(AI_RUNTIME_SOURCES.LUMA).getAssistantLanguageModel();
    const result = await model.doStream({ prompt: [] } as never);

    const reader = result.stream.getReader();
    await reader.read(); // stream-start
    await reader.read(); // text-start
    await reader.read(); // text-delta
    await expect(reader.read()).rejects.toBe(failure);
    expect(openAiChatModel.doStream).not.toHaveBeenCalled();
    expect(openAiProvider).not.toHaveBeenCalled();
  });

  it("uses OpenAI directly for the assistant when Luma does not run chat", async () => {
    const model: LanguageModelV4 = await createService(
      AI_RUNTIME_SOURCES.CORE,
    ).getAssistantLanguageModel();

    expect(model).toBe(openAiChatModel);
    expect(loadOpenAiSdk).not.toHaveBeenCalled();
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
    expect(loadOpenAiSdk).not.toHaveBeenCalled();
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
    expect(loadOpenAiSdk).not.toHaveBeenCalled();
  });
});
