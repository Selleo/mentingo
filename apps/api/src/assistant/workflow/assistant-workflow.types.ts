import type { AssistantOutcome, AssistantOutcomeValidation } from "./assistant-outcome.types";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { AssistantRunActivity, AssistantMessageRole, AssistantRunStatus } from "@repo/shared";

export type AssistantWorkflowInput = {
  runId: string;
  tenantId: string;
  userId?: string;
  threadId?: string;
  trace?: { traceId: string; spanId: string; traceFlags: number };
};
export type { AssistantWorkflowRunState } from "@repo/shared";

export type AssistantRuntimeInput = AssistantWorkflowInput & {
  createdAt: string;
  threadId: string;
  userId: string;
  language: string;
  origin: string;
};
export type AssistantSource = { title: string; url: string };
export type AssistantWorkflowContext = {
  run: {
    id: string;
    userId: string;
    threadId: string;
    language: string;
    origin: string;
    status: AssistantRunStatus;
  };
  messages: Array<{ role: AssistantMessageRole; content: string }>;
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
};

/** The narrow application port used only by durable Node steps, never by replay code. */
export interface AssistantExecutionPort {
  loadContext(input: AssistantWorkflowInput): Promise<AssistantWorkflowContext>;
  getModel(input: AssistantWorkflowInput): Promise<LanguageModelV4>;
  executeTool(
    input: AssistantWorkflowInput,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  setActivity(input: AssistantWorkflowInput, activity: AssistantRunActivity): Promise<void>;
  validateOutcome(
    input: AssistantWorkflowInput,
    outcome: AssistantOutcome,
  ): Promise<AssistantOutcomeValidation>;
  checkpoint(
    input: AssistantWorkflowInput,
    text: string,
    sources: AssistantSource[],
    kind?: AssistantOutcome["kind"],
    requiresReadableContent?: boolean,
  ): Promise<unknown>;
  complete(
    input: AssistantWorkflowInput,
    text: string,
    sources: AssistantSource[],
    kind?: AssistantOutcome["kind"],
    requiresReadableContent?: boolean,
  ): Promise<AssistantOutcomeValidation>;
  fail(input: AssistantWorkflowInput, errorCode: string): Promise<unknown>;
}
