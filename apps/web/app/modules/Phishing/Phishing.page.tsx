import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { usePhishingCampaigns } from "~/api/queries/usePhishingCampaigns";
import { hasAllPermissions, hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

import { PhishingGate } from "./PhishingGate";
function Campaigns() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingCampaigns();
  const canCreate = hasAllPermissions(user?.permissions ?? [], [
    PERMISSIONS.PHISHING_MANAGE,
    PERMISSIONS.COURSE_ENROLLMENT,
  ]);
  const canReport = hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_REPORT_READ);
  return (
    <PageWrapper>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("phishing.title")}</h1>
        {canCreate && (
          <Button asChild>
            <Link to="/phishing/new">{t("phishing.newCampaign")}</Link>
          </Button>
        )}
      </div>
      <p className="mb-6 text-neutral-600">{t("phishing.description")}</p>
      {isPending && <p role="status">{t("phishing.loading")}</p>}
      {isError && (
        <p role="alert">
          {t("phishing.serviceError")}{" "}
          <Button onClick={() => void refetch()}>{t("phishing.retry")}</Button>
        </p>
      )}
      {data?.length === 0 && <p>{t("phishing.empty")}</p>}
      <div className="grid gap-4">
        {data?.map((campaign) => (
          <article key={campaign.id} className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">{campaign.name}</h2>
              <span>{t(`phishing.status.${campaign.status}`)}</span>
            </div>
            <p>
              {new Date(campaign.sendWindow.start).toLocaleString()} –{" "}
              {new Date(campaign.sendWindow.end).toLocaleString()}
            </p>
            {canReport && (
              <Link className="text-primary-700 underline" to={`/phishing/${campaign.id}`}>
                {t("phishing.report")}
              </Link>
            )}
          </article>
        ))}
      </div>
    </PageWrapper>
  );
}
export default function PhishingPage() {
  return (
    <PhishingGate>
      <Campaigns />
    </PhishingGate>
  );
}
