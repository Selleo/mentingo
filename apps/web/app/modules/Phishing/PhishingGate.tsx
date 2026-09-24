import { useTranslation } from "react-i18next";

import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

import type { ReactNode } from "react";
export function PhishingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = usePhishingConfiguration();
  if (isPending)
    return (
      <PageWrapper>
        <p role="status">{t("phishing.loading")}</p>
      </PageWrapper>
    );
  if (isError)
    return (
      <PageWrapper>
        <p role="alert">{t("phishing.serviceError")}</p>
        <Button onClick={() => void refetch()}>{t("phishing.retry")}</Button>
      </PageWrapper>
    );
  if (!data?.enabled)
    return (
      <PageWrapper>
        <h1 className="text-2xl font-semibold">{t("phishing.title")}</h1>
        <p>{t("phishing.unavailable")}</p>
      </PageWrapper>
    );
  return <>{children}</>;
}
