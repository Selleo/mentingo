export const VOICE_ACTION = {
  TRANSCRIPT: "transcript",
  VOICE_MENTOR: "voiceMentor",
} as const;

export type VoiceAction = (typeof VOICE_ACTION)[keyof typeof VOICE_ACTION];

export const VOICE_SOCKET_EVENT = {
  START_AUDIO: "startAudio",
  AUDIO_STARTED: "audioStarted",
  AUDIO_CHUNK: "audioChunk",
  AUDIO_SPEECH: "audioSpeech",
  AUDIO_INTERRUPTED: "audioInterrupted",
  AUDIO_OUTPUT_COMPLETED: "audioOutputCompleted",
  MENTOR_TRANSCRIPTION: "mentorTranscription",
  MENTOR_RESPONSE_COMPLETED: "mentorResponseCompleted",
  STOP_AUDIO: "stopAudio",
  CANCEL_AUDIO: "cancelAudio",
  TRIGGER_TTS: "triggerTTS",
} as const;

export type VoiceSocketEvent = (typeof VOICE_SOCKET_EVENT)[keyof typeof VOICE_SOCKET_EVENT];
