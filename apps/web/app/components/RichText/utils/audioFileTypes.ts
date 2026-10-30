import { ALLOWED_AUDIO_FILE_TYPES } from "@repo/shared";

// Explicit extensions allow browsers with an empty/generic File.type to select audio.
// This list is a picker hint, not a substitute for server-side content validation.
export const AUDIO_ACCEPTED_FILE_TYPES = [
  ...ALLOWED_AUDIO_FILE_TYPES,
  ".mp3",
  ".m4a",
  ".wav",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
];
