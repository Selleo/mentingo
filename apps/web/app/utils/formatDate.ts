export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
  language: string,
): string {
  return new Intl.DateTimeFormat(language, options).format(new Date(date));
}
