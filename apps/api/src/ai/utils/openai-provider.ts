import type { OpenAIProvider, createOpenAI as CreateOpenAI } from "@ai-sdk/openai";

export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

type OpenAIProviderOptions = {
  apiKey?: string;
  baseURL?: string;
};

/**
 * Builds the OpenAI provider used by every core AI feature.
 *
 * When `baseURL` points to an OpenAI-compatible gateway (OpenRouter, LiteLLM, vLLM...), language
 * models go through Chat Completions: gateways implement it, but rarely the Responses API that
 * the SDK uses by default. Without a gateway the OpenAI URL is passed explicitly, because the SDK
 * would otherwise read OPENAI_BASE_URL itself and turn an empty variable into an empty URL.
 */
export const buildOpenAIProvider = (
  createOpenAI: typeof CreateOpenAI,
  { apiKey, baseURL }: OpenAIProviderOptions,
): OpenAIProvider => {
  const gatewayURL = baseURL?.trim() || undefined;
  const provider = createOpenAI({ apiKey, baseURL: gatewayURL ?? OPENAI_DEFAULT_BASE_URL });

  if (!gatewayURL) return provider;

  const chatModel = (modelId: Parameters<OpenAIProvider["chat"]>[0]) => provider.chat(modelId);

  return Object.assign(chatModel, provider, { languageModel: chatModel }) as OpenAIProvider;
};
