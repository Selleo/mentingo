import type { createUIMessageStream, streamText } from "ai";
import type { AiRuntimeSource } from "src/ai/ai-runtime.types";
import type { UUIDType } from "src/common";

export type AiStreamMessageInput = {
  threadId: UUIDType;
  content: string;
  id?: UUIDType;
  voiceSessionId?: string;
  voiceTurnWasInterrupted?: boolean;
  abortSignal?: AbortSignal;
};

export type AiStreamTextResult = ReturnType<typeof streamText>;

export type AiUiMessageStream = ReturnType<typeof createUIMessageStream>;

export type AiTranscriptionResult = {
  text: string;
};

export type AiMentorChatStreamResult = {
  source: AiRuntimeSource;
  textStream: AsyncIterable<string>;
  coreStream?: AiStreamTextResult;
};
