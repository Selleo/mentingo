import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { ASSISTANT_OUTCOME_KINDS, ASSISTANT_RUN_ERROR_CODES } from "@repo/shared";
import { jsonSchema, tool } from "ai";
import { FatalError, getWritable } from "workflow";

import { AssistantModel } from "./assistant-model";
import { isAcceptedAssistantOutcome } from "./assistant-outcome";
import { withAssistantTrace } from "./assistant-tracing";
import { getAssistantExecution } from "./assistant-workflow.bridge";

import type { AssistantOutcome } from "./assistant-outcome.types";
import type { AssistantWorkflowInput } from "./assistant-workflow.types";

export async function assistantWorkflow(input: AssistantWorkflowInput) {
  "use workflow";

  let failureCode: string = ASSISTANT_RUN_ERROR_CODES.GENERATION_FAILED;
  try {
    const context = await loadContext(input);
    const tools = Object.fromEntries(
      context.tools.map((definition) => [
        definition.name,
        tool({
          description: definition.description,
          inputSchema: jsonSchema<Record<string, unknown>>(definition.inputSchema),
          execute: (args) => executeTool(input, definition.name, args),
        }),
      ]),
    );
    const respond = tool({
      description:
        "Propose the final reply. An accepted result finishes the turn. If rejected, use the returned feedback to repair the proposal or retrieve evidence, then call respond again. Use conversation for greetings, general help or clarifying questions without factual product claims. Use answer for findings supported by completed read tools.",
      inputSchema: jsonSchema<AssistantOutcome>({
        type: "object",
        properties: {
          kind: { type: "string", enum: Object.values(ASSISTANT_OUTCOME_KINDS) },
          requiresReadableContent: { type: "boolean" },
          text: { type: "string", minLength: 1, maxLength: 16000 },
        },
        required: ["kind", "text", "requiresReadableContent"],
        additionalProperties: false,
      }),
      execute: (outcome) => validateOutcome(input, outcome),
    });
    const agent = new WorkflowAgent({
      model: new AssistantModel(input),
      tools: { ...tools, respond },
      instructions: context.instructions,
      toolChoice: "required",
      maxOutputTokens: 2500,
      maxRetries: 1,
      toolCallConcurrency: 1,
      stopWhen: ({ steps }) =>
        steps.length >= 8 ||
        steps.some((step) =>
          step.toolResults.some(
            (call) => call.toolName === "respond" && isAcceptedAssistantOutcome(call.output),
          ),
        ),
      telemetry: {
        isEnabled: true,
        functionId: "core-assistant",
        recordInputs: false,
        recordOutputs: false,
      },
    });
    const result = await agent.stream({
      messages: context.messages,
      writable: getWritable<ModelCallStreamPart>(),
      timeout: 120_000,
    });
    if ("error" in result) throw new Error("Assistant model generation failed");
    const response = result.toolResults.find(
      (call) => call.toolName === "respond" && isAcceptedAssistantOutcome(call.output),
    )?.output;
    if (!isAcceptedAssistantOutcome(response)) {
      failureCode = ASSISTANT_RUN_ERROR_CODES.OUTCOME_VALIDATION_FAILED;
      throw new Error("Assistant did not produce an accepted outcome within its step budget");
    }
    const completion = await complete(input, response.outcome);
    if (!completion.accepted) {
      failureCode = ASSISTANT_RUN_ERROR_CODES.OUTCOME_VALIDATION_FAILED;
      throw new Error("Assistant outcome no longer satisfies its evidence policy");
    }
  } catch {
    await fail(input, failureCode);
    throw new FatalError("Assistant generation failed");
  }
}

async function loadContext(input: AssistantWorkflowInput) {
  "use step";
  return withAssistantTrace(input, "core-assistant.context", () =>
    getAssistantExecution().loadContext(input),
  );
}

async function executeTool(
  input: AssistantWorkflowInput,
  name: string,
  args: Record<string, unknown>,
) {
  "use step";
  return withAssistantTrace(input, `core-assistant.tool.${name}`, () =>
    getAssistantExecution().executeTool(input, name, args),
  );
}

async function validateOutcome(input: AssistantWorkflowInput, outcome: AssistantOutcome) {
  "use step";
  return withAssistantTrace(input, "core-assistant.validate-outcome", () =>
    getAssistantExecution().validateOutcome(input, outcome),
  );
}

async function complete(input: AssistantWorkflowInput, outcome: AssistantOutcome) {
  "use step";
  return withAssistantTrace(input, "core-assistant.complete", () =>
    getAssistantExecution().complete(
      input,
      outcome.text,
      [],
      outcome.kind,
      outcome.requiresReadableContent,
    ),
  );
}

async function fail(input: AssistantWorkflowInput, code: string) {
  "use step";
  await withAssistantTrace(input, "core-assistant.failed", () =>
    getAssistantExecution().fail(input, code),
  );
}
