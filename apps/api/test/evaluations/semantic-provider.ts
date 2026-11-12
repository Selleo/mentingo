import { Type } from "@sinclair/typebox";

import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";

import { sha256 } from "./semantic-evaluator";

import type { SemanticProvider, SemanticProviderConfig } from "./semantic-evaluator.types";

export const SEMANTIC_RESPONSE_SCHEMA = Type.Object(
  {
    dimensions: Type.Array(
      Type.Object(
        {
          dimensionId: Type.String({ minLength: 1 }),
          status: Type.Union([
            Type.Literal("pass"),
            Type.Literal("fail"),
            Type.Literal("insufficient_evidence"),
          ]),
          reason: Type.String({ minLength: 1, maxLength: 600 }),
          evidence: Type.Array(
            Type.Object(
              {
                recordId: Type.String({ minLength: 1 }),
                quote: Type.String({ minLength: 1, maxLength: 1000 }),
              },
              { additionalProperties: false },
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

/** Creating this adapter requires explicit CLI opt-in; construction itself makes no requests. */
export function createSemanticProvider(config: SemanticProviderConfig): {
  provider: SemanticProvider;
  metadata: Record<string, unknown>;
} {
  if (
    !config.model?.trim() ||
    !/^[A-Z][A-Z0-9_]*$/.test(config.apiKeyEnv) ||
    (config.baseURL !== undefined && typeof config.baseURL !== "string") ||
    (config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 120000))
  )
    throw new Error("Invalid explicit judge configuration");
  if (config.baseURL) {
    const url = new URL(config.baseURL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw new Error("Judge baseURL must be HTTPS without embedded credentials");
  }
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error("Judge credential environment variable is missing");
  const publicConfig = {
    model: config.model,
    baseURL: config.baseURL ?? "https://api.openai.com/v1",
    timeoutMs: config.timeoutMs ?? 60000,
    maxOutputTokens: 4096,
    maxRetries: 0,
  };
  return {
    metadata: {
      ...publicConfig,
      configSha256: sha256(JSON.stringify(publicConfig)),
      telemetryEnabled: false,
    },
    provider: async ({ system, prompt }) => {
      const [{ generateText, Output, jsonSchema }, { createOpenAI }] = await Promise.all([
        loadAiSdk(),
        loadOpenAiSdk(),
      ]);
      const provider = createOpenAI({ apiKey, baseURL: config.baseURL });
      const result = await generateText({
        model: provider(config.model),
        system,
        prompt,
        output: Output.object({ schema: jsonSchema<unknown>(() => SEMANTIC_RESPONSE_SCHEMA) }),
        maxOutputTokens: publicConfig.maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(publicConfig.timeoutMs),
        providerOptions: { openai: { store: false } },
        telemetry: { isEnabled: false },
      });
      if (result.output === undefined) throw new Error("Judge returned no structured output");
      return JSON.stringify(result.output);
    },
  };
}
