import type { LUMA_CAPTURE_PROFILES, LumaCaptureProfile } from "@japro/luma-sdk";

export const VOICE_ACTION = {
  TRANSCRIPT: "transcript",
  VOICE_MENTOR: "voiceMentor",
} as const;

export type VoiceAction = (typeof VOICE_ACTION)[keyof typeof VOICE_ACTION];

export const VOICE_CAPTURE_PROFILE = {
  CONTINUOUS_PCM: "continuous_pcm",
  VAD_SEGMENTED: "vad_segmented",
} as const satisfies typeof LUMA_CAPTURE_PROFILES;

export type VoiceCaptureProfile = LumaCaptureProfile;

export const VOICE_SOCKET_EVENT = {
  START_AUDIO: "startAudio",
  AUDIO_STARTED: "audioStarted",
  AUDIO_CHUNK: "audioChunk",
  AUDIO_SPEECH: "audioSpeech",
  AUDIO_INTERRUPTED: "audioInterrupted",
  AUDIO_OUTPUT_COMPLETED: "audioOutputCompleted",
  MENTOR_TRANSCRIPTION: "mentorTranscription",
  MENTOR_RESPONSE_DELTA: "mentorResponseDelta",
  MENTOR_RESPONSE_COMPLETED: "mentorResponseCompleted",
  STOP_AUDIO: "stopAudio",
  CANCEL_AUDIO: "cancelAudio",
  CLIENT_SPEECH_START: "clientSpeechStart",
  CLIENT_SPEECH_END: "clientSpeechEnd",
  TRIGGER_TTS: "triggerTTS",
} as const;

export type VoiceSocketEvent = (typeof VOICE_SOCKET_EVENT)[keyof typeof VOICE_SOCKET_EVENT];
