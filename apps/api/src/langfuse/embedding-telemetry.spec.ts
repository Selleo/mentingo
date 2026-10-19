import { execFileSync } from "node:child_process";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import * as aiEsm from "src/ai/utils/ai-esm";
import { SemanticSearchEmbeddingService } from "src/global-search/semantic-search-index.embedding.service";

import type { EnvService } from "src/env/services/env.service";

// Run ESM dependencies in native Node, outside Jest's CommonJS VM. This keeps the
// standard CI command compatible without requiring --experimental-vm-modules.
const SDK_TELEMETRY_CONTRACT = `
  import assert from "node:assert/strict";
  import { embedMany, registerTelemetry } from "ai";
  import { MockEmbeddingModelV4 } from "ai/test";

  const { telemetry, path } = JSON.parse(process.argv[1]);
  const events = { onStart: 0, onEmbedStart: 0, onEmbedEnd: 0, onEnd: 0, onError: 0 };
  registerTelemetry(Object.fromEntries(
    Object.keys(events).map(name => [name, () => { events[name] += 1; }]),
  ));
  let fail = false;
  const model = new MockEmbeddingModelV4({
    doEmbed: async ({ values }) => {
      if (fail) throw new Error("embedding provider unavailable");
      return { embeddings: values.map(() => [0.1]), usage: { tokens: values.length }, warnings: [] };
    },
  });

  await embedMany({ model, values: ["policy"], telemetry, maxRetries: 0 });
  fail = true;
  await assert.rejects(
    embedMany({ model, values: ["policy"], telemetry, maxRetries: 0 }),
    /embedding provider unavailable/,
  );
  if (path === "mentor") {
    assert.equal(events.onStart, 2);
    assert.ok(events.onEmbedStart > 0);
    assert.ok(events.onEmbedEnd > 0);
    assert.ok(events.onEnd > 0);
    assert.ok(events.onError > 0);
  } else {
    assert.deepEqual(Object.values(events), [0, 0, 0, 0, 0]);
  }

  // Prove the globally registered integration remains active without an opt-out.
  const starts = events.onStart;
  const embeds = events.onEmbedStart;
  fail = false;
  await embedMany({ model, values: ["control"], maxRetries: 0 });
  assert.equal(events.onStart, starts + 1);
  assert.equal(events.onEmbedStart, embeds + 1);
`;

describe("embedding tracing by application path", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(["mentor", "search"])(
    "keeps the configured telemetry behavior for successful and failed %s embeddings",
    async (path) => {
      const embedMany = jest.fn().mockResolvedValue({
        embeddings: [Array(1536).fill(0.1)],
      });
      const model = {};
      const runtime = new AiRuntimeService({} as EnvService);
      jest.spyOn(runtime, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.CORE);
      jest.spyOn(runtime, "getAISdkOpenAI").mockResolvedValue({
        embeddingModel: () => model,
        embedding: () => model,
      } as never);
      jest.spyOn(aiEsm, "loadAiSdk").mockResolvedValue({ embedMany } as never);
      const search = new SemanticSearchEmbeddingService(runtime);
      const embed = () => {
        if (path === "mentor") return runtime.createEmbeddings(["policy"]);
        return search.embedTexts(["policy"]);
      };

      expect(await embed()).toEqual([Array(1536).fill(0.1)]);
      embedMany.mockRejectedValue(new Error("embedding provider unavailable"));
      await expect(embed()).rejects.toThrow("embedding provider unavailable");
      expect(embedMany).toHaveBeenCalledTimes(2);
      const options = embedMany.mock.calls[0][0] as { telemetry?: { isEnabled?: boolean } };
      for (const [call] of embedMany.mock.calls) {
        expect(call.telemetry).toEqual(options.telemetry);
      }
      expect(options.telemetry?.isEnabled).toBe(path === "mentor");

      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          SDK_TELEMETRY_CONTRACT,
          JSON.stringify({ telemetry: options.telemetry, path }),
        ],
        { cwd: process.cwd(), timeout: 15_000, stdio: "pipe" },
      );
    },
  );
});
