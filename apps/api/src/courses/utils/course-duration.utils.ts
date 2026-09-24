import { load as loadHtml } from "cheerio";
import { match } from "ts-pattern";

import { extractLessonResourceIds } from "src/lesson/lesson-resource-references";
import { LESSON_TYPES } from "src/lesson/lesson.type";

import { DURATION_DEFAULTS, DURATION_DISPLAY_BUCKET_SECONDS } from "../constants/duration-defaults";

import type {
  DurationEstimate,
  DurationCourseRow,
  DurationEstimatesByLanguage,
  DurationResource,
  LessonDurationCalculationParams,
} from "../types/duration";
import type { LocalizedText, SupportedLanguages } from "@repo/shared";

export const calculateLessonDurationSeconds = (params: LessonDurationCalculationParams): number => {
  const $ = loadHtml(params.descriptionHtml ?? "");
  const readingSeconds = Math.ceil(
    ($.text().trim().split(/\s+/).filter(Boolean).length / DURATION_DEFAULTS.wordsPerMinute) * 60,
  );
  const counts = { video: 0, image: 0, download: 0, presentation: 0 };
  $("[data-node-type]").each((_, element) => {
    const nodeType = $(element).attr("data-node-type");
    if (nodeType === "video")
      counts.video += getVideoDurationSeconds(
        $(element).attr("data-src"),
        params.resourcesByReference,
      );
    if (nodeType === "image") counts.image += 1;
    if (nodeType === "downloadable-file") counts.download += 1;
    if (nodeType === "presentation") counts.presentation += 1;
  });
  $("a").each((_, element) => {
    if ($(element).closest("[data-node-type='image']").length) return;
    const source = $(element).attr("data-resource-id") ?? $(element).attr("href");
    const reference = source ? (extractLessonResourceIds(source)[0] ?? source) : undefined;
    const resource = reference ? params.resourcesByReference?.get(reference) : undefined;
    if (resource?.contentType.startsWith("image/")) counts.image += 1;
  });
  return match(params.lessonType)
    .with(
      LESSON_TYPES.CONTENT,
      () =>
        readingSeconds +
        counts.video +
        counts.image * DURATION_DEFAULTS.imageSeconds +
        counts.download * DURATION_DEFAULTS.downloadSeconds +
        counts.presentation * DURATION_DEFAULTS.embedMinutes * 60 +
        params.quizQuestionCount * DURATION_DEFAULTS.quizSeconds,
    )
    .with(
      LESSON_TYPES.QUIZ,
      () => readingSeconds + params.quizQuestionCount * DURATION_DEFAULTS.quizSeconds,
    )
    .with(LESSON_TYPES.AI_MENTOR, () => readingSeconds + DURATION_DEFAULTS.aiMentorMinutes * 60)
    .with(LESSON_TYPES.EMBED, () => readingSeconds + DURATION_DEFAULTS.embedMinutes * 60)
    .otherwise(() => readingSeconds);
};

export const getVideoDurationSeconds = (
  source: string | undefined,
  resourcesByReference: Map<string, DurationResource> | undefined,
): number => {
  const reference = source ? extractLessonResourceIds(source)[0] : undefined;
  const resource = reference ? resourcesByReference?.get(reference) : undefined;
  const duration = resource?.metadata?.durationSeconds;
  if (
    resource?.contentType.startsWith("video/") &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
  )
    return Math.ceil(duration);
  return DURATION_DEFAULTS.videoMinutes * 60;
};

export const extractEmbeddedResourceIds = (content: string | null | undefined): string[] =>
  extractLessonResourceIds(content);

export const emptyLanguageEstimates = (
  languages: readonly SupportedLanguages[],
): DurationEstimatesByLanguage =>
  Object.fromEntries(
    languages.map((language) => [language, { totalSeconds: 0 }]),
  ) as DurationEstimatesByLanguage;

export const getEstimate = (
  estimates: DurationEstimatesByLanguage | null,
  language: SupportedLanguages,
): DurationEstimate => {
  const estimate = estimates?.[language];
  return estimate && Number.isFinite(estimate.totalSeconds) ? estimate : { totalSeconds: 0 };
};

export const selectDurationLanguage = (
  course: Pick<DurationCourseRow, "baseLanguage" | "availableLocales">,
  language: SupportedLanguages | undefined,
): SupportedLanguages =>
  language && course.availableLocales.includes(language) ? language : course.baseLanguage;

export const getLocalizedDurationDescription = (
  description: LocalizedText | null,
  language: SupportedLanguages,
  baseLanguage: SupportedLanguages,
  availableLocales: SupportedLanguages[],
): string => {
  if (!description) return "";
  if (availableLocales.includes(language))
    return description[language] ?? description[baseLanguage] ?? "";
  return description[baseLanguage] ?? "";
};

export const roundChapterDurationForDisplay = (seconds: number): number =>
  seconds > 0
    ? Math.ceil(seconds / DURATION_DISPLAY_BUCKET_SECONDS) * DURATION_DISPLAY_BUCKET_SECONDS
    : 0;
