import { loadEsm } from "load-esm";

type AiSdkModule = typeof import("ai");
type OpenAiSdkModule = typeof import("@ai-sdk/openai");
type LangfuseVercelAiSdkModule = typeof import("@langfuse/vercel-ai-sdk");

let aiSdkPromise: Promise<AiSdkModule> | undefined;
let openAiSdkPromise: Promise<OpenAiSdkModule> | undefined;
let langfuseVercelAiSdkPromise: Promise<LangfuseVercelAiSdkModule> | undefined;

export const loadAiSdk = (): Promise<AiSdkModule> => {
  aiSdkPromise ??= loadEsm<AiSdkModule>("ai");
  return aiSdkPromise;
};

export const loadOpenAiSdk = (): Promise<OpenAiSdkModule> => {
  openAiSdkPromise ??= loadEsm<OpenAiSdkModule>("@ai-sdk/openai");
  return openAiSdkPromise;
};

export const loadLangfuseVercelAiSdk = (): Promise<LangfuseVercelAiSdkModule> => {
  langfuseVercelAiSdkPromise ??= loadEsm<LangfuseVercelAiSdkModule>("@langfuse/vercel-ai-sdk");
  return langfuseVercelAiSdkPromise;
};
