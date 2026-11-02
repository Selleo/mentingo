export const REDIS_TTL = 59 * 60 * 1000;
export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024;
export const MAX_PRESENTATION_FILE_SIZE_VALUE = 150;
export const MAX_PRESENTATION_FILE_SIZE_UNIT = "MB";
export const MAX_PRESENTATION_FILE_SIZE = MAX_PRESENTATION_FILE_SIZE_VALUE * 1024 * 1024;
export const PRESENTATION_PDF_PREVIEW_CONTENT_TYPE = "application/pdf";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
  "text/csv",
] as const;

export const EXTENSION_TO_MIME_TYPE_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const ALLOWED_EXCEL_MIME_TYPES_MAP = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export const ALLOWED_EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
] as const;

export const RESOURCE_RELATIONSHIP_TYPES = {
  ATTACHMENT: "attachment",
  THUMBNAIL: "thumbnail",
  CONTENT: "content",
  COVER: "cover",
  ICON: "icon",
  BANNER: "banner",
  TRAILER: "trailer",
  MEDIA: "media",
  LIVE_TRAINING_BEFORE: "live_training_before",
  LIVE_TRAINING_AFTER: "live_training_after",
  PROMPT_IMAGE: "prompt_image",
} as const;

export type ResourceRelationshipType =
  (typeof RESOURCE_RELATIONSHIP_TYPES)[keyof typeof RESOURCE_RELATIONSHIP_TYPES];

export const RESOURCE_CATEGORIES = {
  EMAIL_TEMPLATE: "email-templates",
  NEWS: "news",
  ARTICLES: "articles",
  LESSON: "lesson",
  COURSE: "course",
  GLOBAL_SETTINGS: "global_settings",
  LIVE_TRAINING: "live_training",
} as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[keyof typeof RESOURCE_CATEGORIES];

export const TUS_VERSION = "1.0.0";

export const VALIDATED_AUDIO_MIME_TYPES = {
  MP3: "audio/mpeg",
  M4A: "audio/mp4",
  WAV: "audio/wav",
  OGG: "audio/ogg",
  WEBM: "audio/webm",
} as const;

export type ValidatedAudioMimeType =
  (typeof VALIDATED_AUDIO_MIME_TYPES)[keyof typeof VALIDATED_AUDIO_MIME_TYPES];

export const VALIDATED_AUDIO_FILE_EXTENSIONS: Record<ValidatedAudioMimeType, string> = {
  [VALIDATED_AUDIO_MIME_TYPES.MP3]: ".mp3",
  [VALIDATED_AUDIO_MIME_TYPES.M4A]: ".m4a",
  [VALIDATED_AUDIO_MIME_TYPES.WAV]: ".wav",
  [VALIDATED_AUDIO_MIME_TYPES.OGG]: ".ogg",
  [VALIDATED_AUDIO_MIME_TYPES.WEBM]: ".webm",
};

export const FFPROBE_AUDIO_FORMATS = {
  WAV: "wav",
  MP3: "mp3",
  MP4: "mov,mp4,m4a,3gp,3g2,mj2",
  OGG: "ogg",
  MATROSKA: "matroska,webm",
} as const;

export const FFPROBE_AUDIO_CODECS = {
  PCM_S16LE: "pcm_s16le",
  MP3: "mp3",
  AAC: "aac",
  VORBIS: "vorbis",
  OPUS: "opus",
} as const;

export const AAC_LOW_COMPLEXITY_PROFILE = "LC";

export const M4A_MAJOR_BRANDS = ["M4A ", "isom", "iso2", "mp41", "mp42"] as const;

export const AUDIO_PROBE_TIMEOUT_MS = 15_000;
export const AUDIO_DECODE_TIMEOUT_MS = 120_000;

/** ffmpeg demuxers allowed to parse uploaded audio, so playlists and concat files are never opened. */
export const AUDIO_DEMUXER_WHITELIST = "mp3,wav,mov,ogg,matroska";
