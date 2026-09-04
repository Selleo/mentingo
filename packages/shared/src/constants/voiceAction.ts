import type { LUMA_CAPTURE_PROFILES, LumaCaptureProfile } from "@japro/luma-sdk/contracts";

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

export const VOICE_ENDPOINTING_MODE = {
  CLIENT_VAD: "client",
  PROVIDER: "provider",
} as const;

export type VoiceEndpointingMode =
  (typeof VOICE_ENDPOINTING_MODE)[keyof typeof VOICE_ENDPOINTING_MODE];

export const VOICE_SOCKET_EVENT = {
  START_AUDIO: "startAudio",
  AUDIO_STARTED: "audioStarted",
  AUDIO_CHUNK: "audioChunk",
  AUDIO_CHUNK_ACCEPTED: "audio:chunked",
  AUDIO_CHUNK_ERROR: "audio:chunk_error",
  AUDIO_SPEECH: "audioSpeech",
  AUDIO_OUTPUT_ALIGNMENT: "audioOutputAlignment",
  AUDIO_INTERRUPTED: "audioInterrupted",
  AUDIO_OUTPUT_COMPLETED: "audioOutputCompleted",
  AUDIO_RECONNECT: "audio_reconnect",
  AUDIO_RECOVERY_STARTED: "audio:recovery_started",
  AUDIO_RECOVERED: "audio:recovered",
  AUDIO_RECONNECT_ERROR: "audio:reconnect_error",
  SESSION_METADATA_CLEARED: "voice:sessionMetadataCleared",
  LEARNER_TRANSCRIPTION: "learnerTranscription",
  MENTOR_RESPONSE_DELTA: "mentorResponseDelta",
  MENTOR_RESPONSE_COMPLETED: "mentorResponseCompleted",
  STOP_AUDIO: "stopAudio",
  CANCEL_AUDIO: "cancelAudio",
  CLIENT_SPEECH_START: "clientSpeechStart",
  CLIENT_SPEECH_END: "clientSpeechEnd",
  TRIGGER_TTS: "triggerTTS",
} as const;

export type VoiceSocketEvent = (typeof VOICE_SOCKET_EVENT)[keyof typeof VOICE_SOCKET_EVENT];
