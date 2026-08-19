import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

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

export function startInstrumentation() {
  if (instrumentationStarted) return;

  sdk.start();
  instrumentationStarted = true;
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
