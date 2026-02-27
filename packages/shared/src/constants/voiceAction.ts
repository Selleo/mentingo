export const VOICE_ACTION = {
  TRANSCRIPT: "transcript",
} as const;

export type VoiceAction = (typeof VOICE_ACTION)[keyof typeof VOICE_ACTION];

export const VOICE_SOCKET_EVENT = {
  START_AUDIO: "startAudio",
  AUDIO_CHUNK: "audioChunk",
  STOP_AUDIO: "stopAudio",
  CANCEL_AUDIO: "cancelAudio",
} as const;

export type VoiceSocketEvent = (typeof VOICE_SOCKET_EVENT)[keyof typeof VOICE_SOCKET_EVENT];
