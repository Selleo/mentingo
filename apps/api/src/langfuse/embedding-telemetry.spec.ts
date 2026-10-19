import { loadEsm } from "load-esm";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import * as aiEsm from "src/ai/utils/ai-esm";
import { SemanticSearchEmbeddingService } from "src/global-search/semantic-search-index.embedding.service";

import type { EnvService } from "src/env/services/env.service";

describe("embedding tracing by application path", () => {
  const callbacks = {
    onStart: jest.fn(),
    onEmbedStart: jest.fn(),
    onEmbedEnd: jest.fn(),
    onEnd: jest.fn(),
    onError: jest.fn(),
  };
  let sdk: Awaited<ReturnType<typeof aiEsm.loadAiSdk>>;
  let testSdk: typeof import("ai/test");

  beforeAll(async () => {
    sdk = await aiEsm.loadAiSdk();
    testSdk = await loadEsm<typeof import("ai/test")>("ai/test");
    sdk.registerTelemetry(callbacks);
  });

  beforeEach(() => jest.clearAllMocks());

  it.each(["mentor", "search"])(
    "keeps the configured telemetry behavior for successful and failed %s embeddings",
    async (path) => {
      const doEmbed = jest.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => Array(1536).fill(0.1) as number[]),
        usage: { tokens: values.length },
        warnings: [],
      }));
      const model = new testSdk.MockEmbeddingModelV4({ doEmbed });
      const runtime = new AiRuntimeService({} as EnvService);
      jest.spyOn(runtime, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.CORE);
      jest.spyOn(runtime, "getAISdkOpenAI").mockResolvedValue({
        embeddingModel: () => model,
        embedding: () => model,
      } as never);
      jest.spyOn(aiEsm, "loadAiSdk").mockResolvedValue(sdk);
      const search = new SemanticSearchEmbeddingService(runtime);
      const embed = () => {
        if (path === "mentor") return runtime.createEmbeddings(["policy"]);
        return search.embedTexts(["policy"]);
      };

      expect(await embed()).toEqual([Array(1536).fill(0.1)]);
      doEmbed.mockRejectedValue(new Error("embedding provider unavailable"));
      await expect(embed()).rejects.toThrow("embedding provider unavailable");

      if (path === "mentor") {
        expect(callbacks.onStart).toHaveBeenCalledTimes(2);
        expect(callbacks.onEmbedStart).toHaveBeenCalled();
        expect(callbacks.onEmbedEnd).toHaveBeenCalled();
        expect(callbacks.onError).toHaveBeenCalled();
        return;
      }

      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();

      // Prove the globally registered integration is active unless the call opts out.
      doEmbed.mockResolvedValue({ embeddings: [[0.1]], usage: { tokens: 1 }, warnings: [] });
      await sdk.embedMany({ model, values: ["control"] });
      expect(callbacks.onStart).toHaveBeenCalledTimes(1);
      expect(callbacks.onEmbedStart).toHaveBeenCalledTimes(1);
    },
  );
});
