import { useTranslation } from "react-i18next";

import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { PageWrapper } from "~/components/PageWrapper";

import { PhishingEmpty, PhishingError, PhishingLoading } from "./PhishingStates";

import type { ReactNode } from "react";
export function PhishingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = usePhishingConfiguration();
  if (isPending)
    return (
      <PageWrapper>
        <PhishingLoading />
      </PageWrapper>
    );
  if (isError)
    return (
      <PageWrapper>
        <PhishingError onRetry={() => void refetch()} />
      </PageWrapper>
    );
  if (!data?.enabled)
    return (
      <PageWrapper>
        <h1 className="h4 mb-6">{t("phishing.title")}</h1>
        <PhishingEmpty message={t("phishing.unavailable")} />
      </PageWrapper>
    );
  return <>{children}</>;
}
