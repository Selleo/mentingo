import type { VoiceAction } from "../constants/voiceAction";

export type {
  AudioChunkedPayload,
  AudioProtocolErrorPayload,
  AudioReconnectPayload,
  AudioRecoveryPayload,
  AudioStartedPayload,
} from "@japro/luma-sdk/contracts";

import type { LearnerTranscriptStatus, SpeechAlignmentWord } from "@japro/luma-sdk/contracts";

export type AudioRecoveryStartedPayload = {
  attempt: number;
};

export type ClientSpeechBoundaryPayload = {
  sessionRunId: string;
  boundarySeq: number;
  tsMs: number;
  lastAudioSeq: number;
};

export type StopAudioEventPayload = {
  payload?: string;
  voiceAction?: VoiceAction | null;
  translationKey?: string;
  error?: string;
};

export type AudioSpeechEventPayload = {
  seq: number;
  codec: string;
  chunkBase64: string;
  turnId?: string;
  sampleRate?: number | null;
};

export type AudioOutputLifecycleEventPayload = {
  turnId?: string;
};

export type LearnerTranscriptionEventPayload = {
  text: string;
  turnId: string;
  segmentId: string;
  revision: number;
  status: LearnerTranscriptStatus;
  jobId?: string;
};

export type AudioOutputAlignmentEventPayload = {
  turnId: string;
  sequence: number;
  words: SpeechAlignmentWord[];
};

export type { LearnerTranscriptStatus, SpeechAlignmentWord } from "@japro/luma-sdk/contracts";
export { LEARNER_TRANSCRIPT_STATUSES } from "@japro/luma-sdk/contracts";

export type MentorResponseDeltaEventPayload = {
  text: string;
  jobId?: string;
};

export type MentorResponseCompletedEventPayload = {
  text: string;
  jobId?: string;
  reason: "complete" | "error";
};
