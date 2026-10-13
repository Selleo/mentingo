import { useTranslation } from "react-i18next";

import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { PageWrapper } from "~/components/PageWrapper";

import { PhishingEmpty, PhishingError, PhishingHeader, PhishingLoading } from "./PhishingStates";

import type { ReactNode } from "react";
export function PhishingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = usePhishingConfiguration();
  const breadcrumbs = [{ title: t("phishing.title"), href: "/phishing" }];
  if (isPending)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <PhishingLoading />
      </PageWrapper>
    );
  if (isError)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <PhishingError onRetry={() => void refetch()} />
      </PageWrapper>
    );
  if (!data?.enabled)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex flex-col gap-4">
          <PhishingHeader title={t("phishing.title")} />
          <PhishingEmpty message={t("phishing.unavailable")} />
        </div>
      </PageWrapper>
    );
  return <>{children}</>;
}
