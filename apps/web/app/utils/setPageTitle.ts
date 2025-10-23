import { t } from "i18next";

import type { MetaMatches } from "@remix-run/react/dist/routeModules";
import type { ParentRouteData } from "~/modules/layout";

export const setPageTitle = (matches: MetaMatches<Record<string, unknown>>, tKey: string) => {
  const i18n = t(tKey);
  const parentMatch = matches.find(({ id }) => id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - ${i18n}` : i18n;

  return [{ title }];
};
