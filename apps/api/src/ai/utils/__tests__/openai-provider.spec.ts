import { buildOpenAIProvider, OPENAI_DEFAULT_BASE_URL } from "../openai-provider";

describe("buildOpenAIProvider", () => {
  const createFakeOpenAI = () => {
    const chat = jest.fn((modelId: string) => ({ api: "chat", modelId }));
    const embeddingModel = jest.fn((modelId: string) => ({ api: "embedding", modelId }));
    const createOpenAI = jest.fn(() =>
      Object.assign((modelId: string) => ({ api: "responses", modelId }), { chat, embeddingModel }),
    );

    return { createOpenAI, chat };
  };

  it("keeps the Responses API when no base URL is configured", () => {
    const { createOpenAI } = createFakeOpenAI();

    const provider = buildOpenAIProvider(createOpenAI as never, { apiKey: "sk-test" });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: OPENAI_DEFAULT_BASE_URL,
    });
    expect(provider("gpt-5.4-mini" as never)).toEqual({
      api: "responses",
      modelId: "gpt-5.4-mini",
    });
  });

  it("routes language models through Chat Completions behind a compatible gateway", () => {
    const { createOpenAI, chat } = createFakeOpenAI();
    const baseURL = "https://openrouter.ai/api/v1";

    const provider = buildOpenAIProvider(createOpenAI as never, { apiKey: "sk-or-test", baseURL });

    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-or-test", baseURL });
    expect(provider("openai/gpt-5.4-mini" as never)).toEqual({
      api: "chat",
      modelId: "openai/gpt-5.4-mini",
    });
    expect(provider.languageModel("openai/gpt-5.4-mini" as never)).toEqual({
      api: "chat",
      modelId: "openai/gpt-5.4-mini",
    });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("keeps the other model factories of the provider", () => {
    const { createOpenAI } = createFakeOpenAI();

    const provider = buildOpenAIProvider(createOpenAI as never, {
      apiKey: "sk-or-test",
      baseURL: "https://openrouter.ai/api/v1",
    });

    expect(provider.embeddingModel("openai/text-embedding-3-small")).toEqual({
      api: "embedding",
      modelId: "openai/text-embedding-3-small",
    });
  });

  // The SDK reads OPENAI_BASE_URL on its own when baseURL is undefined, and an empty variable
  // would become an empty base URL, so the default is always passed explicitly.
  it("treats a blank base URL as not configured", () => {
    const { createOpenAI } = createFakeOpenAI();

    const provider = buildOpenAIProvider(createOpenAI as never, {
      apiKey: "sk-test",
      baseURL: "  ",
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: OPENAI_DEFAULT_BASE_URL,
    });
    expect(provider("gpt-5.4-mini" as never)).toEqual({
      api: "responses",
      modelId: "gpt-5.4-mini",
    });
  });
});
