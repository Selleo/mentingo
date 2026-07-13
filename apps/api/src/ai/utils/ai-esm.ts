import { loadEsm } from "load-esm";

type AiSdkModule = typeof import("ai");
type OpenAiSdkModule = typeof import("@ai-sdk/openai");

let aiSdkPromise: Promise<AiSdkModule> | undefined;
let openAiSdkPromise: Promise<OpenAiSdkModule> | undefined;

export const loadAiSdk = (): Promise<AiSdkModule> => {
  aiSdkPromise ??= loadEsm<AiSdkModule>("ai");
  return aiSdkPromise;
};

export const loadOpenAiSdk = (): Promise<OpenAiSdkModule> => {
  openAiSdkPromise ??= loadEsm<OpenAiSdkModule>("@ai-sdk/openai");
  return openAiSdkPromise;
};
