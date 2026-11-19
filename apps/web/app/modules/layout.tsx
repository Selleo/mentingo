import { type MetaFunction, Outlet, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { useCompanyInformationSuspense } from "~/api/queries/useCompanyInformationSuspense";
import { queryClient } from "~/api/queryClient";
import { SkipToContentLink } from "~/components/SkipToContentLink";
import { formatPageTitle, getPlatformName } from "~/utils/setPageTitle";

export const meta: MetaFunction = () => {
  const companyInformation = queryClient.getQueryData(companyInformationQueryOptions.queryKey);

  return [{ title: formatPageTitle([], getPlatformName(companyInformation?.data)) }];
};

export default function Layout() {
  const { data: companyInfo } = useCompanyInformationSuspense();
  const { i18n } = useTranslation();
  const { revalidate } = useRevalidator();
  const platformName = getPlatformName(companyInfo.data);

  // Remix metadata cannot subscribe to Query or i18n state. Route metadata ran before the company
  // information and the user's language were known, so re-render it. Only redirect-only
  // clientLoaders exist, so revalidation is cheap.
  useEffect(() => {
    revalidate();
  }, [platformName, i18n.language, revalidate]);

  return (
    <>
      <SkipToContentLink />
      <Outlet />
    </>
  );
}
