import { useNavigate, useParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { BarChart3, Ban, RefreshCw, ShieldAlert } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PhishingCourseStatusBadge, PhishingStatusBadge } from "./PhishingBadges";
import { PhishingGate } from "./PhishingGate";
import { PhishingLoading, PhishingError, PhishingHeader } from "./PhishingStates";

const REPORT_VIEWS = { REPORT: "report", HALL: "hall" } as const;

function Report({ hall = false }: { hall?: boolean }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingReport(id);
  const { mutateAsync: cancel, isPending: cancelling } = useCancelPhishingCampaign();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (isPending) return <PhishingLoading />;
  if (isError || !data) return <PhishingError onRetry={() => void refetch()} />;
  const recipients = hall
    ? data.recipients.filter((r) => r.clickedAt || r.submittedAt)
    : data.recipients;
  const groups = hall
    ? [...data.groups].sort((a, b) => b.totals.riskRate - a.totals.riskRate)
    : data.groups;
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
            <PhishingStatusBadge status={data.campaign.status} />
            <Button variant="outline" onClick={() => void refetch()}>
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
      <Tabs
        value={hall ? REPORT_VIEWS.HALL : REPORT_VIEWS.REPORT}
        onValueChange={(view) =>
          navigate(view === REPORT_VIEWS.HALL ? `/phishing/${id}/hall-of-shame` : `/phishing/${id}`)
        }
      >
        <div className="overflow-x-auto border-b">
          <TabsList className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0">
            {[
              { value: REPORT_VIEWS.REPORT, label: t("phishing.report"), Icon: BarChart3 },
              { value: REPORT_VIEWS.HALL, label: t("phishing.hall"), Icon: ShieldAlert },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {(["recipients", "sent", "clicked", "submitted", "riskRate"] as const).map((key) => (
          <Card key={key} className="rounded-xl shadow-sm">
            <CardContent className="flex flex-col gap-1 p-5">
              <p className="text-sm text-neutral-600">{t(`phishing.metrics.${key}`)}</p>
              <strong className="h4 text-neutral-950">
                {data.totals[key]}
                {key === "riskRate" && "%"}
              </strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <h5 className="h5 text-neutral-950">{t("phishing.groups")}</h5>
        <Table className="border bg-neutral-50" aria-label={t("phishing.groups")}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("phishing.columns.group")}</TableHead>
              <TableHead scope="col" className="w-40">
                {t("phishing.columns.atRisk")}
              </TableHead>
              <TableHead scope="col" className="w-40">
                {t("phishing.columns.riskRate")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!groups.length && (
              <TableRow>
                <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                  {t("phishing.noResults")}
                </TableCell>
              </TableRow>
            )}
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="text-sm">{g.name}</TableCell>
                <TableCell className="text-sm">
                  {g.totals.risky}/{g.totals.recipients}
                </TableCell>
                <TableCell className="text-sm">{g.totals.riskRate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="flex flex-col gap-3">
        <h5 className="h5 text-neutral-950">{t("phishing.people")}</h5>
        <div className="overflow-x-auto">
          <Table className="border bg-neutral-50" aria-label={t("phishing.people")}>
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
              {!recipients.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {t("phishing.noResults")}
                  </TableCell>
                </TableRow>
              )}
              {recipients.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="text-muted-foreground">{r.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.sentAt
                      ? formatLocalizedDate(i18n.language, r.sentAt)
                      : t("phishing.pending")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLocalizedDate(i18n.language, r.clickedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLocalizedDate(i18n.language, r.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <PhishingCourseStatusBadge status={r.courseStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function ReportPage({ hall }: { hall: boolean }) {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { data } = usePhishingReport(id);
  const breadcrumbs = [
    { title: t("phishing.title"), href: "/phishing" },
    { title: data?.campaign.name ?? t("phishing.report"), href: `/phishing/${id}` },
    ...(hall ? [{ title: t("phishing.hall"), href: `/phishing/${id}/hall-of-shame` }] : []),
  ];
  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <Report hall={hall} />
    </PageWrapper>
  );
}

export function PhishingReport({ hall = false }: { hall?: boolean }) {
  return (
    <PhishingGate>
      <ReportPage hall={hall} />
    </PhishingGate>
  );
}
