export function formatReportPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

export function formatReportDate(value: string | null | undefined, language: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value));
}
