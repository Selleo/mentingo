import { t } from "i18next";

import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";

import type { MetaMatches } from "@remix-run/react/dist/routeModules";
import type { GetCompanyInformationResponse } from "~/api/generated-api";

const PAGE_TITLE_SEPARATOR = " – ";

const DEFAULT_PLATFORM_NAME = "Mentingo";

export const getPlatformName = (companyInformation?: GetCompanyInformationResponse["data"]) =>
  companyInformation?.companyShortName?.trim() ||
  companyInformation?.companyName?.trim() ||
  DEFAULT_PLATFORM_NAME;

export const formatPageTitle = (parts: Array<string | null | undefined>, platformName: string) =>
  [...parts, platformName].filter(Boolean).join(PAGE_TITLE_SEPARATOR);

export const setPageTitle = (_matches: MetaMatches<Record<string, unknown>>, tKey: string) => {
  const companyInformation = queryClient.getQueryData(companyInformationQueryOptions.queryKey);

  return [{ title: formatPageTitle([t(tKey)], getPlatformName(companyInformation?.data)) }];
};
