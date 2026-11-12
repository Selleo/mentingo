/** Native Luma chat additions used through the published SDK's existing methods. */
import type { JSONObject } from "@ai-sdk/provider";

export type NativeLumaToolCall = { id: string; name: string; arguments: JSONObject };
export type NativeLumaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: NativeLumaToolCall[];
  toolCallId?: string;
};
export type NativeLumaChatRequest = {
  messages: NativeLumaMessage[];
  streamFormat: "events";
  tools?: { name: string; description?: string; inputSchema: JSONObject }[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  topP?: number;
};
export type NativeLumaUsage = { inputTokens: number; outputTokens: number };
export type NativeLumaFinishReason = "stop" | "length" | "tool-calls" | "content-filter" | "other";
export type NativeLumaFinish = { finishReason: NativeLumaFinishReason; usage?: NativeLumaUsage };
export type NativeLumaChatResult = NativeLumaFinish & {
  message: string;
  toolCalls: NativeLumaToolCall[];
};
export type NativeLumaChatEvent =
  | { type: "text-delta"; text: string }
  | ({ type: "tool-call" } & NativeLumaToolCall)
  | ({ type: "finish" } & NativeLumaFinish)
  | { type: "error"; code: "provider_request_failed" };

/** SDK 0.4 forwards additive fields; newer SDK types expose this same wire contract. */
export type NativeLumaMentorClient = {
  generateChat(request: NativeLumaChatRequest): Promise<unknown>;
  streamChat(
    request: NativeLumaChatRequest,
    options: { signal: AbortSignal },
  ): Promise<{ data: AsyncIterable<Uint8Array> }>;
};
