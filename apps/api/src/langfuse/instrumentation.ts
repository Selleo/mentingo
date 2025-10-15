import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

import type { SpanProcessor } from "@opentelemetry/sdk-trace-node";

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
  baseUrl: process.env.LANGFUSE_HOST ?? "http://localhost:3002",
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? "",
  flushAt: 5,
}) as unknown as SpanProcessor;

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

export function startInstrumentation() {
  sdk.start();
}
