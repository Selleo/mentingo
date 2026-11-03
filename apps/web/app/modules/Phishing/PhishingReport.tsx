import { useParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Ban, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelPhishingCampaign } from "~/api/mutations/useCancelPhishingCampaign";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { phishingReportQueryKey, usePhishingReport } from "~/api/queries/usePhishingReport";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

import { PhishingGate } from "./PhishingGate";
import { PhishingPeopleTable } from "./PhishingPeopleTable";
import { PHISHING_RISKY_ACTIONS } from "./phishingReport.utils";
import { PhishingActivityFeed, PhishingOverview } from "./PhishingReportOverview";
import { PhishingLoading, PhishingError, PhishingHeader } from "./PhishingStates";

function Report() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingReport(id);
  const { mutateAsync: cancel, isPending: cancelling } = useCancelPhishingCampaign();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (isPending) return <PhishingLoading />;
  if (isError || !data) return <PhishingError onRetry={() => void refetch()} />;
  const tracksSubmissions = data.riskyAction === PHISHING_RISKY_ACTIONS.SUBMITTED;
  const canCancel =
    hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_MANAGE) &&
    data.campaign.status === "scheduled";
  async function cancelCampaign() {
    try {
      await cancel(id);
      setConfirmCancel(false);
    } catch {
      /* Mutation hook displays the translated error. */
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PhishingHeader
        title={data.campaign.name}
        description={t("phishing.educationalOnly")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: phishingReportQueryKey(id) })
              }
            >
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {t("phishing.refresh")}
            </Button>
            {canCancel && (
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                <Ban className="mr-2 size-4" aria-hidden="true" />
                {t("phishing.cancel")}
              </Button>
            )}
          </>
        }
      />
      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!cancelling) setConfirmCancel(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("phishing.cancel")}</AlertDialogTitle>
            <AlertDialogDescription>{t("phishing.cancelConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{t("phishing.back")}</AlertDialogCancel>
            <Button disabled={cancelling} onClick={() => void cancelCampaign()}>
              {cancelling ? t("phishing.loading") : t("phishing.cancel")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid gap-4 lg:grid-cols-3">
        <PhishingOverview totals={data.totals} tracksSubmissions={tracksSubmissions} />
        <PhishingActivityFeed activity={data.activity} />
      </div>
      <PhishingPeopleTable
        campaignId={id}
        groups={data.groups}
        totalRecipients={data.totals.recipients}
        tracksSubmissions={tracksSubmissions}
      />
    </div>
  );
}

function ReportPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { data } = usePhishingReport(id);
  const breadcrumbs = [
    { title: t("phishing.title"), href: "/phishing" },
    { title: data?.campaign.name ?? t("phishing.report"), href: `/phishing/${id}` },
  ];
  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <Report />
    </PageWrapper>
  );
}

export function PhishingReport() {
  return (
    <PhishingGate>
      <ReportPage />
    </PhishingGate>
  );
}
