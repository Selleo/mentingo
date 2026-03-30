export const AI_MENTOR_VOICE_MODE = {
  PRESET: "preset",
  CUSTOM: "custom",
} as const;

export type AiMentorVoiceMode = (typeof AI_MENTOR_VOICE_MODE)[keyof typeof AI_MENTOR_VOICE_MODE];

export const AI_MENTOR_TTS_PRESET = {
  MALE: "male",
  FEMALE: "female",
} as const;

export type AiMentorTTSPreset = (typeof AI_MENTOR_TTS_PRESET)[keyof typeof AI_MENTOR_TTS_PRESET];
