import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { usePhishingCampaigns } from "~/api/queries/usePhishingCampaigns";
import { hasAllPermissions, hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardContent } from "~/components/ui/card";

import { PhishingGate } from "./PhishingGate";
import { PhishingLoading, PhishingError, PhishingEmpty } from "./PhishingStates";
function Campaigns() {
  const { t, i18n } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingCampaigns();
  const canCreate = hasAllPermissions(user?.permissions ?? [], [
    PERMISSIONS.PHISHING_MANAGE,
    PERMISSIONS.COURSE_ENROLLMENT,
  ]);
  const canReport = hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_REPORT_READ);
  return (
    <PageWrapper>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="h4">{t("phishing.title")}</h1>
        {canCreate && (
          <Button asChild>
            <Link to="/phishing/new">{t("phishing.newCampaign")}</Link>
          </Button>
        )}
      </div>
      <p className="body-lg-md mb-6 text-muted-foreground">{t("phishing.description")}</p>
      {isPending && <PhishingLoading />}
      {isError && <PhishingError onRetry={() => void refetch()} />}
      {!isPending && !isError && data?.length === 0 && (
        <PhishingEmpty message={t("phishing.empty")} />
      )}
      <div className="grid gap-4">
        {data?.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">{campaign.name}</h2>
                <Badge variant="outline">{t(`phishing.status.${campaign.status}`)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="body-sm text-muted-foreground">
                {new Date(campaign.sendWindow.start).toLocaleString(i18n.language)} –{" "}
                {new Date(campaign.sendWindow.end).toLocaleString(i18n.language)}
              </p>
              {canReport && (
                <Button variant="outline" asChild>
                  <Link to={`/phishing/${campaign.id}`}>{t("phishing.report")}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
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
