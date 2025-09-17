import { SUPPORTED_LOCALES } from "src/common/constants";

import type { SupportedLocales } from "src/common/types";

export const isSupportedLocale = (val: any): val is SupportedLocales =>
  SUPPORTED_LOCALES.includes(val);
