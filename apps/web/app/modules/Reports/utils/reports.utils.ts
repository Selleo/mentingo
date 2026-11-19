import { format, subDays } from "date-fns";

import type { ReportActivityPeriod } from "../types/reports-api.types";

export function formatReportPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

export function formatReportDate(
  value: string | null | undefined,
  language: string,
  timezone: string,
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: timezone }).format(
    new Date(value),
  );
}

export function getActivityPeriodForLastDays(days: number): ReportActivityPeriod {
  const today = new Date();
  return {
    from: format(subDays(today, days - 1), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
}
