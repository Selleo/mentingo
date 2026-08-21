import type { createUIMessageStream, streamText } from "ai";
import type { AiRuntimeSource } from "src/ai/ai-runtime.types";
import type { UUIDType } from "src/common";

export type AiStreamMessageInput = {
  threadId: UUIDType;
  content: string;
  id?: UUIDType;
  lessonId?: UUIDType;
  voiceSessionId?: string;
  voiceTurnId?: string;
  voiceTurnWasInterrupted?: boolean;
  voiceDeliveryContext?: AiVoiceDeliveryContext;
  abortSignal?: AbortSignal;
};

export type AiVoiceDeliveryContext = {
  elapsedMs: number;
  speechMs: number;
  pauseCount: number;
  longestPauseMs: number;
  averagePauseMs: number | null;
  segmentCount: number;
  wordCount: number;
  wordsPerMinute: number | null;
  timingPrecision: string;
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
