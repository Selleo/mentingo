import { loadEsm } from "load-esm";

import { voiceDeliverySentenceSchema } from "src/ai/schemas/voice-delivery.schema";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { streamVoiceSentenceMarkup } from "src/ai/utils/voice-delivery";

type MockModel = import("ai/test").MockLanguageModelV3;
type ModelStream = Awaited<ReturnType<MockModel["doStream"]>>["stream"];
type ModelPart = ModelStream extends ReadableStream<infer Part> ? Part : never;

it.each(["complete", "truncated"])(
  "streams before completion and validates the real SDK envelope: %s",
  async (mode) => {
    const { MockLanguageModelV3 } = await loadEsm<typeof import("ai/test")>("ai/test");
    const { streamText, Output, jsonSchema } = await loadAiSdk();
    let controller!: ReadableStreamDefaultController<ModelPart>;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream<ModelPart>({
          start(value) {
            controller = value;
            started();
          },
        }),
      }),
    });
    const result = streamText({
      model,
      prompt: "Synthetic offline fixture",
      output: Output.array({ element: jsonSchema(() => voiceDeliverySentenceSchema) }),
    });
    const stream = streamVoiceSentenceMarkup(result.elementStream, undefined, () => result.output);
    const first = stream.next();
    // The synthetic provider starts without any HTTP request.
    await ready;
    expect(controller).toBeDefined();
    controller.enqueue({ type: "text-start", id: "reply" });
    controller.enqueue({
      type: "text-delta",
      id: "reply",
      delta: '{"elements":[{"cue":"frustrated","text":"I waited."},{"cue":"',
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Sentence buffered until model completion")),
          1000,
        );
      });
      expect((await Promise.race([first, timeout])).value).toBe("⟦cue:frustrated⟧I waited. ");
    } finally {
      clearTimeout(timer);
    }
    controller.enqueue({
      type: "text-delta",
      id: "reply",
      delta:
        mode === "complete"
          ? 'frustrated","text":"Who can help?"}]}'
          : 'frustrated","text":"unfinished',
    });
    controller.enqueue({ type: "text-end", id: "reply" });
    controller.enqueue({
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    });
    controller.close();
    if (mode === "complete") {
      expect((await stream.next()).value).toBe("⟦cue:frustrated⟧Who can help? ");
      expect((await stream.next()).done).toBe(true);
    } else {
      await expect(stream.next()).rejects.toThrow();
    }
    expect(model.doStreamCalls).toHaveLength(1);
  },
);
