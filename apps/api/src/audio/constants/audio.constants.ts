export const REDIS_AUDIO_SUBSCRIBER_CHANNEL = "audio:subscriber";

export const getAudioMetaKey = (key: string) => `audio:meta:${key}`;
export const getAudioDataKey = (key: string) => `audio:data:${key}`;
export const getAudioTranscriptKey = (key: string) => `audio:transcript:${key}`;

export const AUDIO_EXPIRE = 600; // 10 minutes
