import { createHash } from "node:crypto";

import { propagateAttributes, startActiveObservation, startObservation } from "@langfuse/tracing";

import type { AssistantWorkflowInput } from "./assistant-workflow.types";

export function assistantTraceParent(input: AssistantWorkflowInput) {
  const digest = createHash("sha256")
    .update(`assistant-trace:${input.tenantId}:${input.runId}`)
    .digest("hex");
  return (
    input.trace ?? { traceId: digest.slice(0, 32), spanId: digest.slice(32, 48), traceFlags: 1 }
  );
}

function attributes(input: AssistantWorkflowInput) {
  return {
    asBaggage: true,
    userId: input.userId,
    sessionId: input.threadId,
    metadata: { tenantId: input.tenantId, assistantRunId: input.runId },
  };
}

export function startAssistantRunTrace(input: AssistantWorkflowInput) {
  return propagateAttributes(attributes(input), () =>
    startObservation(
      "core-assistant-run",
      {},
      {
        asType: "agent",
        parentSpanContext: assistantTraceParent(input),
      },
    ),
  );
}

export function withAssistantTrace<T>(
  input: AssistantWorkflowInput,
  name: string,
  operation: () => PromiseLike<T>,
): Promise<T> {
  return startActiveObservation(
    name,
    async () => await propagateAttributes(attributes(input), operation),
    {
      parentSpanContext: assistantTraceParent(input),
    },
  );
}
