import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";

import { AssistantModel } from "src/assistant/workflow/assistant-model";
import { registerAssistantExecution } from "src/assistant/workflow/assistant-workflow.bridge";

import { NativeLumaLanguageModel } from "./native-luma-language-model";

import type { AssistantExecutionPort } from "src/assistant/workflow/assistant-workflow.types";

// Only workflow serialization markers are substituted; the production checkpoint transform runs.
jest.mock("@workflow/serde", () => ({
  WORKFLOW_SERIALIZE: Symbol.for("test.workflow.serialize"),
  WORKFLOW_DESERIALIZE: Symbol.for("test.workflow.deserialize"),
}));

jest.mock("src/assistant/workflow/assistant-tracing", () => ({
  withAssistantTrace: (_input: unknown, _name: string, operation: () => PromiseLike<unknown>) =>
    operation(),
}));

/** Production AssistantModel checkpoints must still observe complete native respond calls. */
describe("native Luma adapter in the assistant model", () => {
  afterEach(() => registerAssistantExecution(undefined));

  it.each([true, false])(
    "checkpoints a respond call only after a valid native finish (%s)",
    async (completed) => {
      const reply = {
        kind: "conversation",
        text: "Hello from native Luma",
        requiresReadableContent: false,
      };
      async function* events(): AsyncGenerator<Uint8Array> {
        yield Buffer.from(
          JSON.stringify({ type: "tool-call", id: "reply", name: "respond", arguments: reply }) +
            "\n",
        );
        if (completed)
          yield Buffer.from(JSON.stringify({ type: "finish", finishReason: "tool-calls" }) + "\n");
      }
      const native = new NativeLumaLanguageModel(async () => ({
        generateChat: jest.fn(),
        streamChat: jest.fn().mockResolvedValue({ data: events() }),
      }));
      const checkpoint = jest.fn();
      const setActivity = jest.fn();
      registerAssistantExecution({
        getModel: jest.fn().mockResolvedValue(native),
        checkpoint,
        setActivity,
      } as unknown as AssistantExecutionPort);
      const identity = { tenantId: "tenant", runId: "run" };
      const model = new AssistantModel(identity);
      const result = await model.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        tools: [{ type: "function", name: "respond", inputSchema: { type: "object" } }],
        toolChoice: { type: "required" },
      });
      const consume = async () => {
        const reader = result.stream.getReader();
        while (!(await reader.read()).done) {
          /* Drain production checkpoint transform. */
        }
      };
      if (completed) {
        await consume();
        expect(setActivity).toHaveBeenCalledWith(identity, ASSISTANT_RUN_ACTIVITIES.WRITING);
        expect(checkpoint).toHaveBeenCalledWith(identity, reply.text, [], reply.kind, false);
      } else {
        await expect(consume()).rejects.toThrow();
        expect(setActivity).not.toHaveBeenCalled();
        expect(checkpoint).not.toHaveBeenCalled();
      }
    },
  );
});
