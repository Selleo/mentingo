import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { loadAiSdk, loadLangfuseVercelAiSdk } from "src/ai/utils/ai-esm";

import type { OnApplicationShutdown } from "@nestjs/common";

const langfuseBaseUrl =
  process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST ?? "http://localhost:3002";

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
  baseUrl: langfuseBaseUrl,
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? "",
  flushAt: 5,
});

export const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

let instrumentationStarted = false;
let shutdownPromise: Promise<void> | undefined;
let instrumentationStartPromise: Promise<void> | undefined;

export function startInstrumentation(): Promise<void> {
  if (instrumentationStartPromise) return instrumentationStartPromise;

  instrumentationStartPromise = (async () => {
    sdk.start();

    const [{ registerTelemetry }, { LangfuseVercelAiSdkIntegration }] = await Promise.all([
      loadAiSdk(),
      loadLangfuseVercelAiSdk(),
    ]);
    registerTelemetry(new LangfuseVercelAiSdkIntegration());

    instrumentationStarted = true;
  })();

  return instrumentationStartPromise;
}

export async function shutdownInstrumentation() {
  if (!instrumentationStarted) return;

  shutdownPromise ??= (async () => {
    await langfuseSpanProcessor.forceFlush();
    await sdk.shutdown();
  })();

  await shutdownPromise;
}

export class LangfuseShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await shutdownInstrumentation();
  }
}
