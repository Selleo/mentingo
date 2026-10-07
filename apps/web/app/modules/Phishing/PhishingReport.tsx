import { Link, useParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelPhishingCampaign } from "~/api/mutations/useCancelPhishingCampaign";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { usePhishingReport } from "~/api/queries/usePhishingReport";
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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

import { PhishingGate } from "./PhishingGate";
import { PhishingLoading, PhishingError, PhishingEmpty } from "./PhishingStates";
function Report({ hall = false }: { hall?: boolean }) {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingReport(id);
  const { mutateAsync: cancel, isPending: cancelling } = useCancelPhishingCampaign();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (isPending)
    return (
      <PageWrapper>
        <PhishingLoading />
      </PageWrapper>
    );
  if (isError || !data)
    return (
      <PageWrapper>
        <PhishingError onRetry={() => void refetch()} />
      </PageWrapper>
    );
  const recipients = hall
    ? data.recipients.filter((r) => r.clickedAt || r.submittedAt)
    : data.recipients;
  const groups = hall
    ? [...data.groups].sort((a, b) => b.totals.riskRate - a.totals.riskRate)
    : data.groups;
  async function cancelCampaign() {
    try {
      await cancel(id);
      setConfirmCancel(false);
    } catch {
      /* Mutation hook displays the translated error. */
    }
  }
  return (
    <PageWrapper>
      <Button variant="ghost" asChild>
        <Link to="/phishing">{t("phishing.back")}</Link>
      </Button>
      <h1 className="h4 my-5 break-words">
        {data.campaign.name}
        {hall && ` — ${t("phishing.hall")}`}
      </h1>
      <div className="mb-5 flex flex-wrap gap-4">
        <Button variant="outline" asChild>
          <Link to={hall ? `/phishing/${id}` : `/phishing/${id}/hall-of-shame`}>
            {hall ? t("phishing.report") : t("phishing.hall")}
          </Link>
        </Button>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("phishing.refresh")}
        </Button>
        {hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_MANAGE) &&
          data.campaign.status === "scheduled" && (
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              {t("phishing.cancel")}
            </Button>
          )}
      </div>
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
      <p className="mb-5 text-neutral-600">{t("phishing.educationalOnly")}</p>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {(["recipients", "sent", "clicked", "submitted", "riskRate"] as const).map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p>{t(`phishing.metrics.${key}`)}</p>
              <strong className="text-2xl">
                {data.totals[key]}
                {key === "riskRate" && "%"}
              </strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 text-xl font-semibold">{t("phishing.groups")}</h2>
      <div className="mb-8 grid gap-3">
        {!groups.length && <PhishingEmpty message={t("phishing.noResults")} />}
        {groups.map((g) => (
          <Card key={g.id}>
            <CardContent className="p-4 body-base">
              {g.name}: {g.totals.risky}/{g.totals.recipients} ({g.totals.riskRate}%)
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 text-xl font-semibold">{t("phishing.people")}</h2>
      {!recipients.length && <PhishingEmpty message={t("phishing.noResults")} />}
      <div className="overflow-x-auto">
        <Table aria-label={t("phishing.people")}>
          <TableHeader>
            <TableRow>
              {["person", "sent", "clicked", "submitted", "courseStatus"].map((key) => (
                <TableHead key={key} scope="col">
                  {t(`phishing.columns.${key}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>
                  {r.firstName} {r.lastName}
                  <br />
                  <span className="text-sm text-neutral-600">{r.email}</span>
                </TableCell>
                <TableCell>
                  {r.sentAt
                    ? new Date(r.sentAt).toLocaleString(i18n.language)
                    : t("phishing.pending")}
                </TableCell>
                <TableCell>
                  {r.clickedAt ? new Date(r.clickedAt).toLocaleString(i18n.language) : "—"}
                </TableCell>
                <TableCell>
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleString(i18n.language) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t(`phishing.courseStatuses.${r.courseStatus}`, {
                      defaultValue: r.courseStatus,
                    })}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
}
export function PhishingReport({ hall = false }: { hall?: boolean }) {
  return (
    <PhishingGate>
      <Report hall={hall} />
    </PhishingGate>
  );
}
