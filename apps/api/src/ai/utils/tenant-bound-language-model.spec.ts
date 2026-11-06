import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantContextConflictError } from "src/storage/db/db-errors";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { TenantBoundLanguageModel } from "./tenant-bound-language-model";

import type {
  LanguageModelV4,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";
import type { DatabasePg } from "src/common";
import type { EnvService } from "src/env/services/env.service";

const generated: LanguageModelV4GenerateResult = {
  content: [{ type: "text", text: "Core fallback" }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: {
      total: undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
  },
  warnings: [],
};

/** Exercise real ALS/runner behavior with provider I/O and database access controlled. */
describe("TenantBoundLanguageModel", () => {
  afterEach(() => dbAls.disable());

  it.each(["generate", "stream"])(
    "re-enters only trusted identity for delayed %s without retaining a finished transaction",
    async (mode) => {
      const transaction = jest.fn();
      const runner = new TenantDbRunnerService({ transaction } as unknown as DatabasePg);
      const options = { prompt: [] };
      const run = jest.fn(async () => {
        expect(dbAls.getStore()).toEqual({ tenantId: "tenant-a", trx: undefined });
        return generated;
      });
      const stream = jest.fn(async (): Promise<LanguageModelV4StreamResult> => {
        await run();
        return { stream: new ReadableStream() };
      });
      const model = {
        specificationVersion: "v4",
        provider: "native",
        modelId: "configured",
        supportedUrls: {},
        doGenerate: run,
        doStream: stream,
      } satisfies LanguageModelV4;
      const bound = await dbAls.run(
        { tenantId: "tenant-a", trx: { closed: true } as unknown as DatabasePg },
        async () => new TenantBoundLanguageModel(model, "tenant-a", runner),
      );
      expect(dbAls.getStore()).toBeUndefined();
      if (mode === "generate") await bound.doGenerate(options);
      else await bound.doStream(options);
      expect(transaction).not.toHaveBeenCalled();
      expect(dbAls.getStore()).toBeUndefined();
    },
  );

  it.each(["generate", "stream"])(
    "rejects %s under a different tenant's active transaction",
    async (mode) => {
      const runner = new TenantDbRunnerService({} as DatabasePg);
      const called = jest.fn();
      const bound = new TenantBoundLanguageModel(
        {
          provider: "native",
          modelId: "test",
          supportedUrls: {},
          doGenerate: called,
          doStream: called,
        } as unknown as LanguageModelV4,
        "tenant-a",
        runner,
      );
      const attempt = dbAls.run({ tenantId: "tenant-b", trx: {} as DatabasePg }, () =>
        mode === "generate" ? bound.doGenerate({ prompt: [] }) : bound.doStream({ prompt: [] }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TenantContextConflictError);
      expect(called).not.toHaveBeenCalled();
    },
  );

  it("resolves delayed Luma failure and Core fallback credentials for the same authorized tenant", async () => {
    const runner = new TenantDbRunnerService({} as DatabasePg);
    const reads: string[] = [];
    const getEnv = jest.fn(async (key: string) => {
      reads.push(`${dbAls.getStore()?.tenantId}:${key}`);
      return { value: "synthetic" };
    });
    const runtime = new AiRuntimeService({ getEnv } as unknown as EnvService);
    jest.spyOn(runtime, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    Object.defineProperty(runtime, "getLumaClient", {
      value: async () => {
        await getEnv("LUMA_API_KEY");
        return {
          mentor: {
            generateChat: jest.fn().mockRejectedValue(new Error("Native unavailable")),
            streamChat: jest.fn(),
          },
        };
      },
    });
    const provider = Object.assign(
      jest.fn().mockReturnValue({ doGenerate: jest.fn().mockResolvedValue(generated) }),
    );
    jest.spyOn(runtime, "getAISdkOpenAI").mockImplementation(async () => {
      await getEnv("OPENAI_API_KEY");
      return provider as never;
    });
    const bound = await runner.runWithTenant(
      "tenant-a",
      async () =>
        new TenantBoundLanguageModel(await runtime.getAssistantLanguageModel(), "tenant-a", runner),
    );
    expect(dbAls.getStore()).toBeUndefined();
    await expect(
      bound.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }] }),
    ).resolves.toEqual(generated);
    expect(reads).toEqual(["tenant-a:LUMA_API_KEY", "tenant-a:OPENAI_API_KEY"]);
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
