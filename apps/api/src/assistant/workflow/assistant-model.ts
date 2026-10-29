import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";
import { WORKFLOW_DESERIALIZE, WORKFLOW_SERIALIZE } from "@workflow/serde";
import loadEsmModule from "load-esm";

import { isAssistantOutcome } from "./assistant-outcome";
import { withAssistantTrace } from "./assistant-tracing";
import { getAssistantExecution } from "./assistant-workflow.bridge";
import { AssistantWorkflowInput } from "./assistant-workflow.types";

import type { LanguageModelV4, LanguageModelV4CallOptions } from "@ai-sdk/provider";

/** Persist actor/run identity only. Resolve tenant credentials afresh inside each model step. */
export class AssistantModel implements LanguageModelV4 {
  readonly specificationVersion = "v4";
  readonly provider = "mentingo.openai";
  readonly modelId = "core-assistant";
  readonly supportedUrls = {};

  constructor(private readonly input: AssistantWorkflowInput) {}

  static [WORKFLOW_SERIALIZE](model: AssistantModel) {
    return model.input;
  }

  static [WORKFLOW_DESERIALIZE](input: AssistantWorkflowInput) {
    return new AssistantModel(input);
  }

  async doGenerate(options: LanguageModelV4CallOptions) {
    "use step";
    const model = await getAssistantExecution().getModel(this.input);
    return withAssistantTrace(this.input, "core-assistant.model", () => model.doGenerate(options));
  }

  async doStream(options: LanguageModelV4CallOptions) {
    "use step";
    const model = await getAssistantExecution().getModel(this.input);
    const result = await withAssistantTrace(this.input, "core-assistant.model", () =>
      model.doStream(options),
    );
    const { parsePartialJson } = await loadEsmModule.loadEsm<typeof import("ai")>("ai");
    const replyInputs = new Map<string, string>();
    let replyInput = "";
    let lastCheckpoint = 0;
    const checkpointReply = async () => {
      const { value } = await parsePartialJson(replyInput);
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      if (!isAssistantOutcome(value)) return;
      const reply = value;
      await getAssistantExecution().checkpoint(
        this.input,
        reply.text.slice(0, 16000),
        [],
        reply.kind,
        reply.requiresReadableContent,
      );
      lastCheckpoint = Date.now();
    };
    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream({
          transform: async (chunk, controller) => {
            if (chunk.type === "tool-input-start" && chunk.toolName === "respond") {
              await getAssistantExecution().setActivity(
                this.input,
                ASSISTANT_RUN_ACTIVITIES.WRITING,
              );
              replyInputs.set(chunk.id, "");
            }
            if (chunk.type === "tool-input-delta" && replyInputs.has(chunk.id)) {
              replyInput = replyInputs.get(chunk.id)! + chunk.delta;
              replyInputs.set(chunk.id, replyInput);
              if (Date.now() - lastCheckpoint >= 400) await checkpointReply();
            }
            if (chunk.type === "tool-call" && chunk.toolName === "respond") {
              replyInput = chunk.input;
              await checkpointReply();
            }
            controller.enqueue(chunk);
          },
          flush: async () => {
            if (replyInput) await checkpointReply();
          },
        }),
      ),
    };
  }
}
