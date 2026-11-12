import type { DurationHeuristics } from "src/courses/duration/course-duration.types";

export const DURATION_DISPLAY_BUCKET_SECONDS = 15 * 60;

export const DURATION_DEFAULTS: DurationHeuristics = {
  wordsPerMinute: 200,
  videoMinutes: 3,
  audioMinutes: 3,
  imageSeconds: 15,
  downloadSeconds: 30,
  quizSeconds: 60,
  aiMentorMinutes: 10,
  embedMinutes: 3,
  otherSeconds: 60,
};

export const DURATION_MEDIA_KINDS = {
  AUDIO: "audio",
  VIDEO: "video",
} as const;

export const DURATION_MEDIA_RULES = {
  [DURATION_MEDIA_KINDS.AUDIO]: {
    contentTypePrefix: "audio/",
    fallbackMinutes: DURATION_DEFAULTS.audioMinutes,
  },
  [DURATION_MEDIA_KINDS.VIDEO]: {
    contentTypePrefix: "video/",
    fallbackMinutes: DURATION_DEFAULTS.videoMinutes,
  },
} as const;
