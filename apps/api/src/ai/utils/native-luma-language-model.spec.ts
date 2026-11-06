import { loadAiSdk } from "./ai-esm";
import { NativeLumaLanguageModel } from "./native-luma-language-model";

import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { NativeLumaChatRequest } from "src/ai/native-luma-chat.types";

const tool = {
  type: "function" as const,
  name: "read_course",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string" as const } },
    required: ["id"],
  },
};
const options: LanguageModelV4CallOptions = {
  prompt: [{ role: "user", content: [{ type: "text", text: "Read course" }] }],
  tools: [tool],
};
const finish = { type: "finish", finishReason: "stop", usage: { inputTokens: 9, outputTokens: 3 } };

/** Collect the AI SDK stream without changing its cancellation/error behavior. */
async function collect(
  stream: ReadableStream<LanguageModelV4StreamPart>,
): Promise<LanguageModelV4StreamPart[]> {
  const reader = stream.getReader();
  const result: LanguageModelV4StreamPart[] = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return result;
    result.push(chunk.value);
  }
}

/** Split every UTF-8 byte to prove neither JSON frames nor Unicode depend on chunk boundaries. */
async function* bytes(events: object[]): AsyncGenerator<Uint8Array> {
  for (const value of Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + "\n"))
    yield Uint8Array.of(value);
}

function setup() {
  const generateChat = jest.fn().mockResolvedValue({
    message: "Answer",
    toolCalls: [],
    finishReason: "stop",
    usage: { inputTokens: 9, outputTokens: 3 },
  });
  const streamChat = jest
    .fn()
    .mockResolvedValue({ data: bytes([{ type: "text-delta", text: "Zażółć" }, finish]) });
  return {
    generateChat,
    streamChat,
    model: new NativeLumaLanguageModel(async () => ({ generateChat, streamChat })),
  };
}

describe("NativeLumaLanguageModel", () => {
  it("preserves system/user/assistant/tool history, schemas, selection and generation settings", async () => {
    const { model, generateChat } = setup();
    generateChat.mockResolvedValueOnce({
      message: "",
      toolCalls: [{ id: "second", name: "read_course", arguments: { id: "two" } }],
      finishReason: "tool-calls",
    });
    const input: LanguageModelV4CallOptions = {
      ...options,
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 300,
      stopSequences: ["END"],
      toolChoice: { type: "tool", toolName: "read_course" },
      prompt: [
        { role: "system", content: "Use authorized tools" },
        ...options.prompt,
        {
          role: "assistant",
          content: [
            { type: "text", text: "Reading" },
            {
              type: "tool-call",
              toolCallId: "first",
              toolName: "read_course",
              input: { id: "one" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "first",
              toolName: "read_course",
              output: { type: "json", value: { title: "Course" } },
            },
          ],
        },
      ],
    };
    await model.doGenerate(input);
    expect(generateChat).toHaveBeenCalledWith({
      streamFormat: "events",
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 300,
      stopSequences: ["END"],
      toolChoice: { name: "read_course" },
      tools: [{ name: "read_course", inputSchema: tool.inputSchema }],
      messages: [
        { role: "system", content: "Use authorized tools" },
        { role: "user", content: "Read course" },
        {
          role: "assistant",
          content: "Reading",
          toolCalls: [{ id: "first", name: "read_course", arguments: { id: "one" } }],
        },
        { role: "tool", content: '{"title":"Course"}', toolCallId: "first" },
      ],
    });
  });

  it("adapts complete tool calls and usage for the actual AI SDK tool loop", async () => {
    const { model, generateChat } = setup();
    generateChat.mockResolvedValueOnce({
      message: "",
      toolCalls: [{ id: "call-1", name: "read_course", arguments: { id: "one" } }],
      finishReason: "tool-calls",
      usage: { inputTokens: 9, outputTokens: 3 },
    });
    const result = await model.doGenerate(options);
    expect(result.content).toEqual([
      { type: "tool-call", toolCallId: "call-1", toolName: "read_course", input: '{"id":"one"}' },
    ]);
    expect(result.finishReason.unified).toBe("tool-calls");
    expect(result.usage.inputTokens.total).toBe(9);
    expect(result.usage.outputTokens.total).toBe(3);
  });

  it("executes the real AI SDK multi-step assistant loop and returns tool history to native Luma", async () => {
    const { model, generateChat } = setup();
    generateChat.mockResolvedValueOnce({
      message: "",
      toolCalls: [{ id: "call-1", name: "read_course", arguments: { id: "one" } }],
      finishReason: "tool-calls",
    });
    const { generateText, jsonSchema, stepCountIs, tool: sdkTool } = await loadAiSdk();
    const execute = jest.fn(async ({ id }: { id: string }) => ({ id, title: "Authorized course" }));
    const result = await generateText({
      model,
      prompt: "Read course",
      tools: {
        read_course: sdkTool({
          inputSchema: jsonSchema<{ id: string }>(tool.inputSchema),
          execute,
        }),
      },
      stopWhen: stepCountIs(3),
      maxRetries: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("Answer");
    expect(generateChat).toHaveBeenCalledTimes(2);
    const second = generateChat.mock.calls[1][0] as NativeLumaChatRequest;
    expect(second.messages).toEqual(
      expect.arrayContaining([
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call-1", name: "read_course", arguments: { id: "one" } }],
        },
        { role: "tool", content: '{"id":"one","title":"Authorized course"}', toolCallId: "call-1" },
      ]),
    );
  });

  it.each([
    { message: "Legacy text-only server" },
    {
      message: "",
      toolCalls: [{ id: "call", name: "not_offered", arguments: {} }],
      finishReason: "tool-calls",
    },
    {
      message: "",
      toolCalls: [{ id: "call", name: "read_course", arguments: "not JSON" }],
      finishReason: "tool-calls",
    },
    {
      message: "",
      toolCalls: [{ id: "call", name: "read_course", arguments: {} }],
      finishReason: "stop",
    },
    { message: "", toolCalls: [], finishReason: "tool-calls" },
  ])(
    "rejects incompatible native output before returning executable tool calls",
    async (response) => {
      const { model, generateChat } = setup();
      generateChat.mockResolvedValueOnce(response);
      await expect(model.doGenerate(options)).rejects.toThrow();
    },
  );

  it.each(["generate", "stream"])(
    "rejects a missing explicitly named tool in native %s",
    async (mode) => {
      const { model } = setup();
      const named: LanguageModelV4CallOptions = {
        ...options,
        toolChoice: { type: "tool", toolName: "read_course" },
      };
      if (mode === "generate") await expect(model.doGenerate(named)).rejects.toThrow();
      else await expect(collect((await model.doStream(named)).stream)).rejects.toThrow();
    },
  );

  it("fails unsupported file prompts before invoking native transport", async () => {
    const { model, generateChat } = setup();
    await expect(
      model.doGenerate({
        prompt: [
          {
            role: "user",
            content: [
              {
                type: "file",
                mediaType: "image/png",
                data: { type: "url", url: new URL("https://example.test/image.png") },
              },
            ],
          },
        ],
      } as never),
    ).rejects.toThrow();
    expect(generateChat).not.toHaveBeenCalled();
  });

  it("discards an in-flight generation on abort without waiting for SDK0.4 upstream cancellation", async () => {
    const { model, generateChat } = setup();
    let complete: (value: unknown) => void = () => undefined;
    generateChat.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const abort = new AbortController();
    const pending = model.doGenerate({ ...options, abortSignal: abort.signal });
    await Promise.resolve();
    abort.abort(new Error("author canceled"));
    await expect(pending).rejects.toThrow("author canceled");
    complete({ message: "Too late", toolCalls: [], finishReason: "stop" });
  });

  it("decodes native UTF-8 text/finish events through arbitrary network chunks", async () => {
    const { model, streamChat } = setup();
    const result = await model.doStream(options);
    const events = await collect(result.stream);
    expect(events).toEqual([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Zażółć" },
      { type: "text-end", id: "text" },
      expect.objectContaining({ type: "finish", finishReason: { unified: "stop", raw: "stop" } }),
    ]);
    expect(streamChat).toHaveBeenCalledWith(expect.objectContaining({ streamFormat: "events" }), {
      signal: expect.any(AbortSignal),
    });
  });

  it("publishes complete streamed tool calls only after a successful native finish", async () => {
    const { model, streamChat } = setup();
    streamChat.mockResolvedValueOnce({
      data: bytes([
        { type: "tool-call", id: "call", name: "read_course", arguments: { id: "one" } },
        { type: "finish", finishReason: "tool-calls" },
      ]),
    });
    const events = await collect((await model.doStream(options)).stream);
    expect(events).toEqual([
      { type: "stream-start", warnings: [] },
      { type: "tool-input-start", id: "call", toolName: "read_course" },
      { type: "tool-input-delta", id: "call", delta: '{"id":"one"}' },
      { type: "tool-input-end", id: "call" },
      { type: "tool-call", toolCallId: "call", toolName: "read_course", input: '{"id":"one"}' },
      expect.objectContaining({ type: "finish" }),
    ]);
  });

  it("does not publish a buffered tool call after cancellation between output events", async () => {
    const { model, streamChat } = setup();
    streamChat.mockResolvedValueOnce({
      data: bytes([
        { type: "tool-call", id: "call", name: "read_course", arguments: {} },
        { type: "finish", finishReason: "tool-calls" },
      ]),
    });
    const abort = new AbortController();
    const reader = (
      await model.doStream({ ...options, abortSignal: abort.signal })
    ).stream.getReader();
    expect((await reader.read()).value?.type).toBe("stream-start");
    expect((await reader.read()).value?.type).toBe("tool-input-start");
    abort.abort(new Error("caller canceled before tool publication"));
    await expect(reader.read()).rejects.toThrow("caller canceled before tool publication");
  });

  it.each([
    [{ type: "tool-call", id: "call", name: "read_course", arguments: { id: "one" } }],
    [
      { type: "tool-call", id: "call", name: "read_course", arguments: {} },
      { type: "error", code: "provider_request_failed" },
    ],
  ])("never exposes a tool call from an incomplete or failed stream", async (...events) => {
    const { model, streamChat } = setup();
    streamChat.mockResolvedValueOnce({ data: bytes(events) });
    const reader = (await model.doStream(options)).stream.getReader();
    expect((await reader.read()).value?.type).toBe("stream-start");
    await expect(reader.read()).rejects.toThrow();
  });
});
