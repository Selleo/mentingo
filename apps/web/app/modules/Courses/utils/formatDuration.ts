import type { TFunction } from "i18next";

const formatMinutes = (minutes: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.minutes", { minutes });

const formatHours = (hours: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.hours", { hours });

const formatHoursAndMinutes = (hours: number, minutes: number, t: TFunction): string =>
  t("modernCourseView.stats.duration.hoursAndMinutes", { hours, minutes });

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

export const formatDurationToHalfHour = (seconds: number | undefined, t: TFunction): string => {
  if (!seconds) return formatMinutes(0, t);

  const roundedMinutes = Math.ceil(seconds / 60 / 30) * 30;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) return formatMinutes(minutes, t);

  return minutes ? formatHoursAndMinutes(hours, minutes, t) : formatHours(hours, t);
};
