import type { DurationHeuristics } from "src/courses/types/duration";

export const DURATION_DISPLAY_BUCKET_SECONDS = 15 * 60;

export const DURATION_DEFAULTS: DurationHeuristics = {
  wordsPerMinute: 200,
  videoMinutes: 3,
  imageSeconds: 15,
  downloadSeconds: 30,
  quizSeconds: 60,
  aiMentorMinutes: 10,
  embedMinutes: 3,
  otherSeconds: 60,
};
