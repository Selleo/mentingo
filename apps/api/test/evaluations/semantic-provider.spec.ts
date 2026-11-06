import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";

import { createSemanticProvider, SEMANTIC_RESPONSE_SCHEMA } from "./semantic-provider";

jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn(), loadOpenAiSdk: jest.fn() }));

describe("semantic provider SDK boundary (mocked, no requests)", () => {
  afterEach(() => {
    delete process.env.CORE_EVAL_TEST_PROVIDER_KEY;
    jest.resetAllMocks();
  });

  it("uses existing AI SDK structured output, disables storage/telemetry and excludes credentials from metadata", async () => {
    process.env.CORE_EVAL_TEST_PROVIDER_KEY = "synthetic-test-key";
    const generateText = jest.fn().mockResolvedValue({ output: { dimensions: [] } });
    const schema = jest.fn((value) => value);
    const model = jest.fn().mockReturnValue("mock-model");
    const createOpenAI = jest.fn().mockReturnValue(model);
    (loadAiSdk as jest.Mock).mockResolvedValue({
      generateText,
      jsonSchema: schema,
      Output: { object: jest.fn().mockReturnValue("structured-output") },
    });
    (loadOpenAiSdk as jest.Mock).mockResolvedValue({ createOpenAI });
    const { provider, metadata } = createSemanticProvider({
      model: "explicit-judge-model",
      apiKeyEnv: "CORE_EVAL_TEST_PROVIDER_KEY",
      timeoutMs: 1000,
    });
    expect(generateText).not.toHaveBeenCalled();
    expect(await provider({ system: "system", prompt: "untrusted data" })).toBe(
      '{"dimensions":[]}',
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        output: "structured-output",
        maxRetries: 0,
        telemetry: { isEnabled: false },
        providerOptions: { openai: { store: false } },
      }),
    );
    expect(model).toHaveBeenCalledWith("explicit-judge-model");
    expect(schema.mock.calls[0][0]()).toEqual(SEMANTIC_RESPONSE_SCHEMA);
    expect(JSON.stringify(metadata)).not.toContain("synthetic-test-key");
    expect(metadata.configSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects missing credentials and credential-bearing URLs before loading SDKs", () => {
    expect(() =>
      createSemanticProvider({ model: "judge", apiKeyEnv: "CORE_EVAL_TEST_PROVIDER_KEY" }),
    ).toThrow();
    expect(() =>
      createSemanticProvider({
        model: "judge",
        apiKeyEnv: "CORE_EVAL_TEST_PROVIDER_KEY",
        baseURL: "https://user:secret@example.invalid/v1",
      }),
    ).toThrow();
    expect(loadAiSdk).not.toHaveBeenCalled();
  });
});
