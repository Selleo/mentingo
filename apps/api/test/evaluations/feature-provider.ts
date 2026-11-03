import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";

import { createSemanticProvider } from "./semantic-provider";

import type { FeatureModel, FeatureProviderConfiguration } from "./feature-catalogue.types";

/** Explicit model adapter for manual feature experiments, not an application E2E simulator. */
export function createFeatureProvider(config: FeatureProviderConfiguration): {
  model: FeatureModel;
  metadata: Record<string, unknown>;
} {
  const { metadata } = createSemanticProvider(config); // Reuse strict explicit credential/URL configuration validation, without invoking its judge.
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error("Missing explicit feature model credential");
  return {
    metadata,
    model: async (request) => {
      const [sdk, { createOpenAI }] = await Promise.all([loadAiSdk(), loadOpenAiSdk()]);
      const provider = createOpenAI({ apiKey, baseURL: config.baseURL });
      if (request.kind === "embedding") {
        if (!request.texts?.length) throw new Error("Embedding task has no input texts");
        const result = await sdk.embedMany({
          model: provider.embedding(config.model),
          values: request.texts,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(config.timeoutMs ?? 60000),
          telemetry: { isEnabled: false },
        });
        return result.embeddings;
      }
      const result = await sdk.generateText({
        model: provider(config.model),
        messages: request.messages,
        output: request.schema
          ? sdk.Output.object({
              schema: sdk.jsonSchema<unknown>(
                () => request.schema as NonNullable<typeof request.schema>,
              ),
            })
          : undefined,
        maxOutputTokens: 4096,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(config.timeoutMs ?? 60000),
        telemetry: { isEnabled: false },
        providerOptions: { openai: { store: false } },
      });
      return request.schema ? result.output : result.text;
    },
  };
}
