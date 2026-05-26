import type { SupportedLanguages } from "@repo/shared";

const formatDate = (date: Date, language: SupportedLanguages) =>
  new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

const formatDateTime = (date: Date, language: SupportedLanguages) =>
  new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const formatTime = (date: Date, language: SupportedLanguages) =>
  new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

export const formatLiveTrainingDateRange = (
  startsAt: string,
  endsAt: string,
  allDay = false,
  language: SupportedLanguages,
) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (allDay) {
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);

    if (start.toDateString() === inclusiveEnd.toDateString()) {
      return formatDate(start, language);
    }

    return `${formatDate(start, language)} - ${formatDate(inclusiveEnd, language)}`;
  }

  const isSameDay = start.toDateString() === end.toDateString();

  if (isSameDay) {
    return `${formatDateTime(start, language)} - ${formatTime(end, language)}`;
  }

  return `${formatDateTime(start, language)} - ${formatDateTime(end, language)}`;
};

export const getPersonDisplayName = (person: { fullName: string | null }, fallback: string) =>
  person.fullName || fallback;
