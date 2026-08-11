import { VOICE_SOCKET_EVENT } from "@repo/shared";

export const AUDIO_CAPTURE_MODE = {
  CONTINUOUS: "continuous",
  VAD_SEGMENTED: "vad_segmented",
} as const;

export type AudioCaptureMode = (typeof AUDIO_CAPTURE_MODE)[keyof typeof AUDIO_CAPTURE_MODE];

export const TRANSCRIPTION_MODE = {
  PAUSE_BATCH: "pause_batch",
  REALTIME_STREAM: "realtime_stream",
} as const;

export const TRANSCRIPTION_PROVIDER = {
  GLADIA: "gladia",
} as const;

export const AUDIO_STREAM_EVENT = {
  RECONNECT: "audio_reconnect",
  START_ACCEPTED: VOICE_SOCKET_EVENT.AUDIO_STARTED,
  RECOVERED: "audio:recovered",
  RECONNECT_ERROR: "audio:reconnect_error",
  CHUNK_ACCEPTED: "audio:chunked",
  CHUNK_ERROR: "audio:chunk_error",
} as const;

export const AUDIO_STREAM_MESSAGE_TYPE = {
  RECONNECT: "audio.reconnect",
} as const;

export const AUDIO_SESSION_ERROR_CODE = {
  RUN_REPLACED: "AUDIO_SESSION_RUN_REPLACED",
  CLOSED: "AUDIO_SESSION_CLOSED",
  CHUNK_SEQUENCE_GAP: "AUDIO_CHUNK_SEQUENCE_GAP",
} as const;

export type AudioStreamLifecycleEvents = {
  startAccepted?: string;
  recovered?: string;
  reconnectError?: string;
  chunkAccepted?: string;
  chunkError?: string;
};

export type AudioReconnectContext = {
  sessionRunId: string;
  lastSentAudioSeq: number;
  attempt: number;
};
