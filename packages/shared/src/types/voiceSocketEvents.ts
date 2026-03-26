import type { VoiceAction } from "../constants/voiceAction";

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

export type MentorTranscriptionEventPayload = {
  text: string;
  jobId?: string;
};

export type MentorResponseCompletedEventPayload = {
  text: string;
  jobId?: string;
  reason: "complete" | "error";
};
