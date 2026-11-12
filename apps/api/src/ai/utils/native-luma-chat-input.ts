/** Preserve text, tool calls and tool results when adapting the AI SDK prompt to Luma. */
import type {
  JSONObject,
  JSONValue,
  LanguageModelV4CallOptions,
  LanguageModelV4ToolResultOutput,
} from "@ai-sdk/provider";
import type { NativeLumaChatRequest, NativeLumaMessage } from "src/ai/native-luma-chat.types";

/** Reject non-JSON input instead of silently changing tool arguments during serialization. */
export function isNativeJson(value: unknown, depth = 0): value is JSONValue {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item: unknown) => isNativeJson(item, depth + 1));
  if (typeof value !== "object") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every((item: unknown) => isNativeJson(item, depth + 1))
  );
}

/** Tool arguments and schemas must remain JSON objects, not arrays or serialized strings. */
export function nativeJsonObject(value: unknown): JSONObject {
  if (!isNativeJson(value) || value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Luma native chat requires JSON object tool arguments and schemas");
  }
  return value as JSONObject;
}

/** Serialize outcomes faithfully, including error and denied execution semantics. */
function toolOutput(output: LanguageModelV4ToolResultOutput): string {
  switch (output.type) {
    case "text":
      return output.value;
    case "json":
      return JSON.stringify(output.value);
    case "error-text":
      return JSON.stringify({ error: output.value });
    case "error-json":
      return JSON.stringify({ error: output.value });
    case "execution-denied":
      return JSON.stringify({ executionDenied: true, reason: output.reason });
    case "content":
      return output.value
        .map((part) => {
          if (part.type !== "text")
            throw new Error("Luma native chat does not support file tool results");
          return part.text;
        })
        .join("\n");
  }
}

/** Map the structured prompt without treating tool outputs as new user instructions. */
function messages(options: LanguageModelV4CallOptions): NativeLumaMessage[] {
  return options.prompt.flatMap((message): NativeLumaMessage[] => {
    if (message.role === "system") return [{ role: message.role, content: message.content }];
    if (message.role === "tool") {
      return message.content.map((part) => {
        if (part.type !== "tool-result")
          throw new Error("Luma native chat does not support tool approval messages");
        return { role: "tool", content: toolOutput(part.output), toolCallId: part.toolCallId };
      });
    }
    let content = "";
    const calls: NonNullable<NativeLumaMessage["toolCalls"]> = [];
    for (const part of message.content) {
      if (part.type === "text") content += part.text;
      else if (
        message.role === "assistant" &&
        part.type === "tool-call" &&
        !part.providerExecuted
      ) {
        calls.push({
          id: part.toolCallId,
          name: part.toolName,
          arguments: nativeJsonObject(part.input),
        });
      } else {
        throw new Error(`Luma native chat does not support prompt part ${part.type}`);
      }
    }
    return [{ role: message.role, content, ...(calls.length ? { toolCalls: calls } : {}) }];
  });
}

/** Unsupported settings fail before I/O so the established fallback retains full fidelity. */
export function nativeLumaRequest(options: LanguageModelV4CallOptions): NativeLumaChatRequest {
  if (
    options.responseFormat?.type === "json" ||
    options.topK !== undefined ||
    options.presencePenalty !== undefined ||
    options.frequencyPenalty !== undefined ||
    options.seed !== undefined ||
    (options.reasoning !== undefined && options.reasoning !== "provider-default")
  ) {
    throw new Error("Luma native chat does not support the requested model settings");
  }
  const tools = options.tools?.map((tool) => {
    if (tool.type !== "function")
      throw new Error("Luma native chat requires client-executed function tools");
    return {
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      inputSchema: nativeJsonObject(tool.inputSchema),
    };
  });
  const choice = options.toolChoice;
  return {
    messages: messages(options),
    streamFormat: "events",
    ...(tools === undefined ? {} : { tools }),
    ...(choice === undefined
      ? {}
      : { toolChoice: choice.type === "tool" ? { name: choice.toolName } : choice.type }),
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
    ...(options.stopSequences === undefined ? {} : { stopSequences: options.stopSequences }),
    ...(options.topP === undefined ? {} : { topP: options.topP }),
  };
}
