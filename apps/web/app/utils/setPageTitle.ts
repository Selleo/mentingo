import { t } from "i18next";

import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";

import type { MetaMatches } from "@remix-run/react/dist/routeModules";

export const setPageTitle = (_matches: MetaMatches<Record<string, unknown>>, tKey: string) => {
  const i18n = t(tKey);
  const companyShortName = queryClient.getQueryData(companyInformationQueryOptions.queryKey)?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - ${i18n}` : i18n;

  return [{ title }];
};
