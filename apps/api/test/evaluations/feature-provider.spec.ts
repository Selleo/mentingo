import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";

import { createFeatureProvider } from "./feature-provider";

jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn(), loadOpenAiSdk: jest.fn() }));

describe("explicit manual feature model SDK adapter (transport mocked)", () => {
  afterEach(() => {
    delete process.env.FEATURE_MODEL_TEST_KEY;
    jest.resetAllMocks();
  });

  it("does not call a provider on construction and disables model telemetry/storage on execution", async () => {
    process.env.FEATURE_MODEL_TEST_KEY = "synthetic-key";
    const generateText = jest.fn().mockResolvedValue({ text: "Badge issue is free." });
    const model = jest.fn().mockReturnValue("fake-model");
    (loadAiSdk as jest.Mock).mockResolvedValue({ generateText });
    (loadOpenAiSdk as jest.Mock).mockResolvedValue({
      createOpenAI: jest.fn().mockReturnValue(model),
    });
    const provider = createFeatureProvider({
      model: "explicit-feature-model",
      apiKeyEnv: "FEATURE_MODEL_TEST_KEY",
    });
    expect(loadAiSdk).not.toHaveBeenCalled();
    expect(JSON.stringify(provider.metadata)).not.toContain("synthetic-key");
    expect(
      await provider.model({
        kind: "prompt",
        messages: [{ role: "user", content: "What does the badge cost?" }],
      }),
    ).toBe("Badge issue is free.");
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        telemetry: { isEnabled: false },
        providerOptions: { openai: { store: false } },
      }),
    );
  });

  it("uses an embedding model rather than treating a chat answer as a vector", async () => {
    process.env.FEATURE_MODEL_TEST_KEY = "synthetic-key";
    const embedMany = jest.fn().mockResolvedValue({ embeddings: [[1, 0]] });
    const embedding = jest.fn().mockReturnValue("fake-embedding-model");
    (loadAiSdk as jest.Mock).mockResolvedValue({ embedMany });
    (loadOpenAiSdk as jest.Mock).mockResolvedValue({
      createOpenAI: jest.fn().mockReturnValue({ embedding }),
    });
    const provider = createFeatureProvider({
      model: "explicit-embedding-model",
      apiKeyEnv: "FEATURE_MODEL_TEST_KEY",
    });
    expect(await provider.model({ kind: "embedding", messages: [], texts: ["badge"] })).toEqual([
      [1, 0],
    ]);
    expect(embedding).toHaveBeenCalledWith("explicit-embedding-model");
    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "fake-embedding-model",
        telemetry: { isEnabled: false },
        maxRetries: 0,
      }),
    );
  });
});
