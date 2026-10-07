import { format, isValid, parseISO } from "date-fns";

import { getDateLocale } from "./getDateLocale";

export function formatLocalizedDate(
  language: string,
  date: Date | string | number | null | undefined,
  pattern = "dd MMM yyyy, HH:mm",
): string {
  if (date == null) return "—";

  const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);

  if (!isValid(parsedDate)) return "—";

  return format(parsedDate, pattern, { locale: getDateLocale(language) });
}
