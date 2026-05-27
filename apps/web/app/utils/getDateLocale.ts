import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { cs, de, enUS, lt, pl } from "date-fns/locale";
import { match } from "ts-pattern";

export function getDateLocale(language: string) {
  const locale = language.split("-")[0];

  return match(locale)
    .with(SUPPORTED_LANGUAGES.PL, () => pl)
    .with(SUPPORTED_LANGUAGES.DE, () => de)
    .with(SUPPORTED_LANGUAGES.CS, () => cs)
    .with(SUPPORTED_LANGUAGES.LT, () => lt)
    .otherwise(() => enUS);
}
