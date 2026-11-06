import { once } from "node:events";
import { createServer } from "node:http";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";

import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { NativeLumaChatRequest } from "src/ai/native-luma-chat.types";
import type { EnvService } from "src/env/services/env.service";

/** Published SDK transport and the real AI SDK tool loop share only native Mentor routes. */
describe("Core native Mentor SDK contract", () => {
  let server: Server;
  let service: AiRuntimeService;
  const originalBaseUrl = process.env.LUMA_BASE_URL;
  const requests: { path?: string; key?: string | string[]; body: NativeLumaChatRequest }[] = [];

  beforeEach(async () => {
    requests.length = 0;
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as NativeLumaChatRequest;
      requests.push({ path: request.url, key: request.headers["x-api-key"], body });
      if (request.url === "/api/public/v1/ai/mentor/chat/generate") {
        response.setHeader("Content-Type", "application/json");
        const afterTool = body.messages.some((message) => message.role === "tool");
        response.end(
          JSON.stringify(
            afterTool
              ? {
                  message: "Course: Native transport",
                  toolCalls: [],
                  finishReason: "stop",
                  usage: { inputTokens: 11, outputTokens: 4 },
                }
              : {
                  message: "",
                  toolCalls: [{ id: "native-call", name: "read_course", arguments: { id: "one" } }],
                  finishReason: "tool-calls",
                  usage: { inputTokens: 8, outputTokens: 3 },
                },
          ),
        );
      } else if (request.url === "/api/public/v1/ai/mentor/chat") {
        response.setHeader("Content-Type", "application/x-ndjson");
        const bytes = Buffer.from(
          [
            { type: "text-delta", text: "Źródło" },
            { type: "tool-call", id: "native-call", name: "read_course", arguments: { id: "one" } },
            {
              type: "finish",
              finishReason: "tool-calls",
              usage: { inputTokens: 8, outputTokens: 3 },
            },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n") + "\n",
        );
        response.write(bytes.subarray(0, 31));
        response.end(bytes.subarray(31));
      } else {
        response.statusCode = 404;
        response.end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.LUMA_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    service = new AiRuntimeService({
      getEnv: jest.fn().mockResolvedValue({ value: "synthetic-native-key" }),
    } as unknown as EnvService);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    jest.spyOn(service, "getAISdkOpenAI").mockRejectedValue(new Error("Unexpected Core fallback"));
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (originalBaseUrl === undefined) delete process.env.LUMA_BASE_URL;
    else process.env.LUMA_BASE_URL = originalBaseUrl;
    jest.restoreAllMocks();
  });

  it("executes a tool and returns its structured history via the actual native generation SDK", async () => {
    const { generateText, jsonSchema, stepCountIs, tool } = await loadAiSdk();
    const execute = jest.fn(async ({ id }: { id: string }) => ({ id, title: "Native transport" }));
    const result = await generateText({
      model: await service.getAssistantLanguageModel(),
      prompt: "Read course",
      tools: {
        read_course: tool({
          inputSchema: jsonSchema<{ id: string }>({
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          }),
          execute,
        }),
      },
      stopWhen: stepCountIs(3),
      maxRetries: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("Course: Native transport");
    expect(requests).toHaveLength(2);
    expect(
      requests.every(
        (request) =>
          request.path === "/api/public/v1/ai/mentor/chat/generate" &&
          request.key === "synthetic-native-key" &&
          request.body.streamFormat === "events",
      ),
    ).toBe(true);
    expect(requests[1].body.messages).toEqual(
      expect.arrayContaining([
        {
          role: "tool",
          content: '{"id":"one","title":"Native transport"}',
          toolCallId: "native-call",
        },
      ]),
    );
    expect(service.getAISdkOpenAI).not.toHaveBeenCalled();
  });

  it("streams validated native text, tool calls and finish metadata through the existing SDK", async () => {
    const model = await service.getAssistantLanguageModel();
    const result = await model.doStream({
      prompt: [{ role: "user", content: [{ type: "text", text: "Read course" }] }],
      tools: [{ type: "function", name: "read_course", inputSchema: { type: "object" } }],
      toolChoice: { type: "required" },
    });
    const reader = result.stream.getReader();
    const events: LanguageModelV4StreamPart[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      events.push(part.value);
    }
    expect(events).toEqual(
      expect.arrayContaining([
        { type: "text-delta", id: "text", delta: "Źródło" },
        {
          type: "tool-call",
          toolCallId: "native-call",
          toolName: "read_course",
          input: '{"id":"one"}',
        },
        expect.objectContaining({
          type: "finish",
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
        }),
      ]),
    );
    expect(requests).toEqual([
      expect.objectContaining({
        path: "/api/public/v1/ai/mentor/chat",
        key: "synthetic-native-key",
        body: expect.objectContaining({ streamFormat: "events", toolChoice: "required" }),
      }),
    ]);
    expect(service.getAISdkOpenAI).not.toHaveBeenCalled();
  });
});
