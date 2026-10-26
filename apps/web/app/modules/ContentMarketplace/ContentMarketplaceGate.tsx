import { useTranslation } from "react-i18next";

import { useContentMarketplaceConfiguration } from "~/api/queries/useContentMarketplaceConfiguration";
import { PageWrapper } from "~/components/PageWrapper";

import {
  ContentMarketplaceEmpty,
  ContentMarketplaceError,
  ContentMarketplaceHeader,
  ContentMarketplaceLoading,
} from "./components/ContentMarketplaceStates";
import { CONTENT_MARKETPLACE_PATH } from "./contentMarketplace.constants";

import type { ReactNode } from "react";

export function ContentMarketplaceGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useContentMarketplaceConfiguration();
  const breadcrumbs = [{ title: t("contentMarketplace.title"), href: CONTENT_MARKETPLACE_PATH }];

  if (isPending)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <ContentMarketplaceLoading />
      </PageWrapper>
    );

  if (isError)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <ContentMarketplaceError onRetry={() => void refetch()} />
      </PageWrapper>
    );

  if (!data?.enabled)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex flex-col gap-4">
          <ContentMarketplaceHeader title={t("contentMarketplace.title")} />
          <ContentMarketplaceEmpty message={t("contentMarketplace.unavailable")} />
        </div>
      </PageWrapper>
    );

  return <>{children}</>;
}
