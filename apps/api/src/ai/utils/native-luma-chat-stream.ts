/** Decode native Luma NDJSON incrementally and expose complete validated AI SDK events. */
import {
  nativeChatError,
  nativeChatEvent,
  nativeUsage,
  sdkToolCall,
  validateNativeFinish,
} from "./native-luma-chat-response";

import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { NativeLumaChatRequest, NativeLumaToolCall } from "src/ai/native-luma-chat.types";

const MAX_EVENT_CHARACTERS = 1_048_576;

/** UTF-8 chunks may split both characters and JSON lines; bound each unfinished event. */
async function* frames(
  chunks: AsyncIterable<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<unknown> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  const parse = (line: string): unknown => {
    if (line.length > MAX_EVENT_CHARACTERS) throw nativeChatError();
    try {
      return JSON.parse(line);
    } catch {
      throw nativeChatError();
    }
  };
  for await (const chunk of chunks) {
    signal.throwIfAborted();
    pending += decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, end).trim();
      pending = pending.slice(end + 1);
      if (line) yield parse(line);
    }
    if (pending.length > MAX_EVENT_CHARACTERS) throw nativeChatError();
  }
  signal.throwIfAborted();
  pending += decoder.decode();
  if (pending.trim()) yield parse(pending.trim());
}

/** Buffer tool calls until the final receipt validates the complete response. */
async function* parts(
  chunks: AsyncIterable<Uint8Array>,
  request: NativeLumaChatRequest,
  signal: AbortSignal,
  cleanup: () => void,
): AsyncGenerator<LanguageModelV4StreamPart> {
  let textOpen = false;
  let finished = false;
  const calls: NativeLumaToolCall[] = [];
  try {
    yield { type: "stream-start", warnings: [] };
    for await (const raw of frames(chunks, signal)) {
      if (finished) throw nativeChatError();
      const event = nativeChatEvent(raw, request);
      switch (event.type) {
        case "error":
          throw nativeChatError();
        case "text-delta":
          if (!event.text) break;
          if (!textOpen) {
            yield { type: "text-start", id: "text" };
            textOpen = true;
          }
          yield { type: "text-delta", id: "text", delta: event.text };
          break;
        case "tool-call":
          if (calls.some((call) => call.id === event.id)) throw nativeChatError();
          calls.push(event);
          break;
        case "finish":
          validateNativeFinish(event, calls, request);
          if (textOpen) yield { type: "text-end", id: "text" };
          for (const call of calls) {
            const tool = sdkToolCall(call);
            yield { type: "tool-input-start", id: call.id, toolName: call.name };
            yield { type: "tool-input-delta", id: call.id, delta: tool.input };
            yield { type: "tool-input-end", id: call.id };
            yield tool;
          }
          yield {
            type: "finish",
            finishReason: { unified: event.finishReason, raw: event.finishReason },
            usage: nativeUsage(event.usage),
          };
          finished = true;
      }
    }
    if (!finished) throw nativeChatError();
  } finally {
    cleanup();
  }
}

/** Backpressure and cancellation propagate to the SDK stream instead of retrying emitted work. */
function nativeLumaStream(
  chunks: AsyncIterable<Uint8Array>,
  request: NativeLumaChatRequest,
  signal: AbortSignal,
  cancel: (reason?: unknown) => void,
  cleanup: () => void,
): ReadableStream<LanguageModelV4StreamPart> {
  const iterator = parts(chunks, request, signal, cleanup);
  return new ReadableStream(
    {
      async pull(controller) {
        try {
          signal.throwIfAborted();
          const next = await iterator.next();
          if (next.done) controller.close();
          else {
            signal.throwIfAborted();
            controller.enqueue(next.value);
          }
        } catch (error) {
          cancel(error);
          controller.error(error);
          await iterator.return(undefined);
        }
      },
      async cancel(reason) {
        cancel(reason);
        await iterator.return(undefined);
      },
    },
    { highWaterMark: 0 },
  );
}

/** Validate real native output before returning a stream, preserving ordinary startup fallback.
 * A legacy text response or initial error rejects here; later failures remain stream errors.
 */
export async function openNativeLumaStream(
  chunks: AsyncIterable<Uint8Array>,
  request: NativeLumaChatRequest,
  signal: AbortSignal,
  cancel: (reason?: unknown) => void,
  cleanup: () => void,
): Promise<ReadableStream<LanguageModelV4StreamPart>> {
  const reader = nativeLumaStream(chunks, request, signal, cancel, cleanup).getReader();
  const buffered: LanguageModelV4StreamPart[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) throw nativeChatError();
      buffered.push(part.value);
      if (part.value.type !== "stream-start") break;
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    reader.releaseLock();
    throw error;
  }
  return new ReadableStream({
    async pull(controller) {
      try {
        signal.throwIfAborted();
        const part = buffered.shift();
        if (part) {
          controller.enqueue(part);
          return;
        }
        const next = await reader.read();
        if (next.done) {
          reader.releaseLock();
          controller.close();
        } else {
          signal.throwIfAborted();
          controller.enqueue(next.value);
        }
      } catch (error) {
        await reader.cancel(error).catch(() => undefined);
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      reader.releaseLock();
    },
  });
}
