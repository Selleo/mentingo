import type { TFunction } from "i18next";

const formatMinutes = (minutes: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.minutes", { minutes });

const formatHours = (hours: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.hours", { hours });

const formatHoursAndMinutes = (hours: number, minutes: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.hoursAndMinutes", { hours, minutes });

export const DURATION_DISPLAY_BUCKET_SECONDS = 15 * 60;

export const roundDurationToDisplayBucket = (seconds: number | null | undefined): number => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 0;

  return Math.ceil(seconds / DURATION_DISPLAY_BUCKET_SECONDS) * DURATION_DISPLAY_BUCKET_SECONDS;
};

export const sumChapterDisplayDurations = (
  chapterDurationsSeconds: readonly (number | null | undefined)[],
): number =>
  chapterDurationsSeconds.reduce<number>(
    (total, chapterDurationSeconds) => total + roundDurationToDisplayBucket(chapterDurationSeconds),
    0,
  );

type DurationLesson = {
  estimatedDurationSeconds?: number | null;
  status?: string | null;
};

type DurationChapter = {
  lessons: readonly DurationLesson[];
};

export const sumRemainingChapterDisplayDurations = (
  chapters: readonly DurationChapter[],
  completedStatus = "COMPLETED",
): number =>
  sumChapterDisplayDurations(
    chapters.map((chapter) =>
      chapter.lessons
        .filter((lesson) => lesson.status !== completedStatus)
        .reduce((total, lesson) => total + (lesson.estimatedDurationSeconds ?? 0), 0),
    ),
  );

export const formatDuration = (seconds: number | undefined, t: TFunction): string => {
  if (!seconds) return formatMinutes(0, t);

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) return formatMinutes(minutes, t);

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? formatHoursAndMinutes(hours, remainingMinutes, t)
    : formatHours(hours, t);
};

export const formatDurationToDisplayBucket = (
  seconds: number | null | undefined,
  t: TFunction,
): string => formatDuration(roundDurationToDisplayBucket(seconds), t);
