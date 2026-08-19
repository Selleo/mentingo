jest.mock("@langfuse/otel", () => ({
  LangfuseSpanProcessor: jest.fn().mockImplementation(() => ({
    forceFlush: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    shutdown: jest.fn().mockResolvedValue(undefined),
    start: jest.fn(),
  })),
}));

import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { LangfuseShutdownService, startInstrumentation } from "src/langfuse/instrumentation";

describe("Langfuse instrumentation lifecycle", () => {
  it("force flushes buffered spans once during application cleanup", async () => {
    startInstrumentation();
    startInstrumentation();

    const sdk = (NodeSDK as jest.Mock).mock.results[0].value;
    const spanProcessor = (LangfuseSpanProcessor as jest.Mock).mock.results[0].value;
    const shutdownService = new LangfuseShutdownService();

    await shutdownService.onApplicationShutdown();
    await shutdownService.onApplicationShutdown();

    expect(sdk.start).toHaveBeenCalledTimes(1);
    expect(spanProcessor.forceFlush).toHaveBeenCalledTimes(1);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });
});
