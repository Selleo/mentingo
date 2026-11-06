/** Validate native response metadata before it can trigger an assistant tool. */
import { nativeJsonObject } from "./native-luma-chat-input";

import type { LanguageModelV4ToolCall, LanguageModelV4Usage } from "@ai-sdk/provider";
import type {
  NativeLumaChatEvent,
  NativeLumaChatRequest,
  NativeLumaChatResult,
  NativeLumaFinish,
  NativeLumaToolCall,
  NativeLumaUsage,
} from "src/ai/native-luma-chat.types";

/** Native errors intentionally do not include echoed provider request bodies. */
export function nativeChatError(): Error {
  return new Error("Luma native chat returned an invalid or failed response");
}

/** Narrow an external response without coercing numbers, arrays or missing fields. */
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw nativeChatError();
  return value as Record<string, unknown>;
}

/** Metadata opt-in must return a recognized finish reason, including on older SDKs. */
export function nativeFinish(value: unknown): NativeLumaFinish {
  const record = object(value);
  const finishReason = record.finishReason;
  if (
    finishReason !== "stop" &&
    finishReason !== "length" &&
    finishReason !== "tool-calls" &&
    finishReason !== "content-filter" &&
    finishReason !== "other"
  )
    throw nativeChatError();
  if (record.usage === undefined || record.usage === null) return { finishReason };
  const usage = object(record.usage);
  if (
    typeof usage.inputTokens !== "number" ||
    typeof usage.outputTokens !== "number" ||
    !Number.isSafeInteger(usage.inputTokens) ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.inputTokens < 0 ||
    usage.outputTokens < 0
  )
    throw nativeChatError();
  return {
    finishReason,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}

/** Permit only offered tool names and complete object arguments, with a stable call ID. */
export function nativeToolCall(value: unknown, request: NativeLumaChatRequest): NativeLumaToolCall {
  const record = object(value);
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !request.tools?.some((tool) => tool.name === record.name) ||
    request.toolChoice === "none"
  )
    throw nativeChatError();
  if (typeof request.toolChoice === "object" && request.toolChoice.name !== record.name)
    throw nativeChatError();
  return { id: record.id, name: record.name, arguments: nativeJsonObject(record.arguments) };
}

/** Tool results cannot be reported as ordinary prose or repeated under one call ID. */
export function validateNativeFinish(
  finish: NativeLumaFinish,
  calls: NativeLumaToolCall[],
  request: NativeLumaChatRequest,
): void {
  if (
    calls.length > 0 !== (finish.finishReason === "tool-calls") ||
    new Set(calls.map((call) => call.id)).size !== calls.length ||
    ((request.toolChoice === "required" || typeof request.toolChoice === "object") &&
      !calls.length &&
      finish.finishReason === "stop")
  )
    throw nativeChatError();
}

/** Parse the native generation extension and fail closed on legacy message-only servers. */
export function nativeChatResult(
  value: unknown,
  request: NativeLumaChatRequest,
): NativeLumaChatResult {
  const record = object(value);
  if (typeof record.message !== "string" || !Array.isArray(record.toolCalls))
    throw nativeChatError();
  const toolCalls = record.toolCalls.map((call: unknown) => nativeToolCall(call, request));
  const finish = nativeFinish(record);
  validateNativeFinish(finish, toolCalls, request);
  return { message: record.message, toolCalls, ...finish };
}

/** Parse one NDJSON frame; unknown events cannot silently drop model output. */
export function nativeChatEvent(
  value: unknown,
  request: NativeLumaChatRequest,
): NativeLumaChatEvent {
  const record = object(value);
  if (record.type === "text-delta" && typeof record.text === "string")
    return { type: record.type, text: record.text };
  if (record.type === "tool-call") return { type: record.type, ...nativeToolCall(record, request) };
  if (record.type === "finish") return { type: record.type, ...nativeFinish(record) };
  if (record.type === "error" && record.code === "provider_request_failed")
    return { type: record.type, code: record.code };
  throw nativeChatError();
}

/** Match AI SDK v4's usage shape without inventing unreported cache/reasoning counts. */
export function nativeUsage(usage?: NativeLumaUsage): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: usage?.inputTokens,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: usage?.outputTokens, text: undefined, reasoning: undefined },
  };
}

/** Hand validated calls back to the AI SDK, which owns actual local tool execution. */
export function sdkToolCall(call: NativeLumaToolCall): LanguageModelV4ToolCall {
  return {
    type: "tool-call",
    toolCallId: call.id,
    toolName: call.name,
    input: JSON.stringify(call.arguments),
  };
}
