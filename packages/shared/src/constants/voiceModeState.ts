export const VOICE_MODE_STATE = {
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
} as const;

export type VoiceModeState = (typeof VOICE_MODE_STATE)[keyof typeof VOICE_MODE_STATE];
