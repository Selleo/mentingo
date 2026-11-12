/** Adapt the existing native Luma Mentor SDK methods to the AI SDK's tool-capable model. */
import { nativeLumaRequest } from "./native-luma-chat-input";
import { nativeChatResult, nativeUsage, sdkToolCall } from "./native-luma-chat-response";
import { openNativeLumaStream } from "./native-luma-chat-stream";

import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";
import type { NativeLumaMentorClient } from "src/ai/native-luma-chat.types";

/** SDK 0.4 generation cannot cancel upstream I/O; discard late results on caller cancellation. */
function abortable<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    pending.then(
      (result) => {
        signal.removeEventListener("abort", abort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

/** Native transport only; the surrounding runtime retains configured Core fallback policy. */
export class NativeLumaLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4";
  readonly provider = "luma.native";
  readonly modelId = "luma-custom-profile";
  readonly supportedUrls = {};

  /** Use the native SDK client resolved by the authorized assistant model step. */
  constructor(private readonly client: () => Promise<NativeLumaMentorClient>) {}

  /** Return complete native tool calls while leaving execution and multi-step control to Core. */
  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    options.abortSignal?.throwIfAborted();
    const request = nativeLumaRequest(options);
    const client = await this.client();
    options.abortSignal?.throwIfAborted();
    const payload = await abortable(client.generateChat(request), options.abortSignal);
    options.abortSignal?.throwIfAborted();
    const response = nativeChatResult(payload, request);
    return {
      content: [
        ...(response.message ? [{ type: "text" as const, text: response.message }] : []),
        ...response.toolCalls.map(sdkToolCall),
      ],
      finishReason: { unified: response.finishReason, raw: response.finishReason },
      usage: nativeUsage(response.usage),
      warnings: [],
    };
  }

  /** Open the native event stream using the SDK's existing cancellation option. */
  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    options.abortSignal?.throwIfAborted();
    const request = nativeLumaRequest(options);
    const client = await this.client();
    options.abortSignal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(options.abortSignal?.reason);
    options.abortSignal?.addEventListener("abort", abort, { once: true });
    const cleanup = () => options.abortSignal?.removeEventListener("abort", abort);
    const cancel = (reason?: unknown) => {
      cleanup();
      controller.abort(reason);
    };
    try {
      const response = await client.streamChat(request, { signal: controller.signal });
      return {
        stream: await openNativeLumaStream(
          response.data,
          request,
          controller.signal,
          cancel,
          cleanup,
        ),
      };
    } catch (error) {
      cancel();
      throw error;
    }
  }
}
