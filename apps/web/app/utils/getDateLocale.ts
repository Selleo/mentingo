import { cs, de, enUS, lt, pl } from "date-fns/locale";
import { match } from "ts-pattern";

export function getDateLocale(language: string) {
  const locale = language.split("-")[0];

  return match(locale)
    .with("pl", () => pl)
    .with("de", () => de)
    .with("cs", () => cs)
    .with("lt", () => lt)
    .otherwise(() => enUS);
}
