import type { AssistantExecutionPort } from "./assistant-workflow.types";

// Bundled ESM workflow steps and the CommonJS Nest host share this one port.
// No run data is stored here: all state belongs to the durable World/repository.
const executionPortKey = Symbol.for("mentingo.assistant.execution-port");
type RuntimeGlobal = typeof globalThis & { [executionPortKey]?: AssistantExecutionPort };

export function registerAssistantExecution(port: AssistantExecutionPort | undefined) {
  (globalThis as RuntimeGlobal)[executionPortKey] = port;
}

export function getAssistantExecution(): AssistantExecutionPort {
  const port = (globalThis as RuntimeGlobal)[executionPortKey];
  if (!port) throw new Error("Assistant execution port is not initialized");
  return port;
}
