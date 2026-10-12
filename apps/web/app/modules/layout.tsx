import { type MetaFunction, Outlet, useLocation } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { useCompanyInformationSuspense } from "~/api/queries/useCompanyInformationSuspense";
import { queryClient } from "~/api/queryClient";

export const meta: MetaFunction = () => {
  const companyShortName = queryClient.getQueryData(companyInformationQueryOptions.queryKey)?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName}` : "Mentingo";

  return [{ title }];
};

export default function Layout() {
  const { data: companyInfo } = useCompanyInformationSuspense();
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const companyShortName = companyInfo.data.companyShortName;
  const previousCompanyName = useRef<string | null>(null);

  // Remix metadata cannot subscribe to Query state. Brand the initial title
  // once the suspense query resolves; later route metadata reads the warm cache.
  useEffect(() => {
    const previousName = previousCompanyName.current;
    previousCompanyName.current = companyShortName ?? null;
    let pageTitle = document.title;
    if (previousName && previousName !== companyShortName) {
      if (pageTitle === previousName) pageTitle = "Mentingo";
      if (pageTitle.startsWith(`${previousName} - `)) {
        pageTitle = pageTitle.slice(previousName.length + 3);
      }
    }
    if (!companyShortName) {
      document.title = pageTitle;
      return;
    }
    if (pageTitle === companyShortName || pageTitle.startsWith(`${companyShortName} - `)) return;
    document.title =
      pageTitle === "Mentingo" ? companyShortName : `${companyShortName} - ${pageTitle}`;
  }, [companyShortName, pathname, i18n.language]);

  return <Outlet />;
}
