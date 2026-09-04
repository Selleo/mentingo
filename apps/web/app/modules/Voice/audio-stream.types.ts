import { VOICE_SOCKET_EVENT } from "@repo/shared";

export const AUDIO_STREAM_EVENT = {
  RECONNECT: VOICE_SOCKET_EVENT.AUDIO_RECONNECT,
  START_ACCEPTED: VOICE_SOCKET_EVENT.AUDIO_STARTED,
  RECOVERY_STARTED: VOICE_SOCKET_EVENT.AUDIO_RECOVERY_STARTED,
  RECOVERED: VOICE_SOCKET_EVENT.AUDIO_RECOVERED,
  RECONNECT_ERROR: VOICE_SOCKET_EVENT.AUDIO_RECONNECT_ERROR,
  CHUNK_ACCEPTED: VOICE_SOCKET_EVENT.AUDIO_CHUNK_ACCEPTED,
  CHUNK_ERROR: VOICE_SOCKET_EVENT.AUDIO_CHUNK_ERROR,
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
  recoveryStarted?: string;
  recovered?: string;
  reconnectError?: string;
  chunkAccepted?: string;
  chunkError?: string;
};

export const VOICE_CONNECTION_STATE = {
  CONNECTED: "connected",
  RECOVERING: "recovering",
  FAILED: "failed",
} as const;

export type VoiceConnectionState =
  (typeof VOICE_CONNECTION_STATE)[keyof typeof VOICE_CONNECTION_STATE];

export type AudioReconnectContext = {
  sessionRunId: string;
  lastSentAudioSeq: number;
  attempt: number;
};
