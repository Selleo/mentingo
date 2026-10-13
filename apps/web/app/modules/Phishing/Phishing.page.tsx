import { Link, useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { usePhishingCampaigns } from "~/api/queries/usePhishingCampaigns";
import { hasAllPermissions, hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PhishingStatusBadge } from "./PhishingBadges";
import { PhishingGate } from "./PhishingGate";
import { PhishingError, PhishingHeader, PhishingLoading } from "./PhishingStates";

function Campaigns() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingCampaigns();
  const canCreate = hasAllPermissions(user?.permissions ?? [], [
    PERMISSIONS.PHISHING_MANAGE,
    PERMISSIONS.COURSE_ENROLLMENT,
  ]);
  const canReport = hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_REPORT_READ);
  const openReport = (id: string) => {
    if (canReport) navigate(`/phishing/${id}`);
  };

  if (isError) return <PhishingError onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <PhishingHeader
        title={t("phishing.title")}
        description={t("phishing.description")}
        actions={
          canCreate && (
            <Button variant="primary" asChild>
              <Link to="/phishing/new">
                <Plus className="mr-2 size-4" />
                {t("phishing.newCampaign")}
              </Link>
            </Button>
          )
        }
      />
      <Table className="border bg-neutral-50" aria-label={t("phishing.title")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("phishing.columns.name")}</TableHead>
            <TableHead className="w-40">{t("phishing.columns.status")}</TableHead>
            <TableHead>{t("phishing.columns.sendWindow")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && (
            <TableRow>
              <TableCell colSpan={3}>
                <PhishingLoading />
              </TableCell>
            </TableRow>
          )}
          {!isPending && !data?.length && (
            <TableRow>
              <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                {t("phishing.empty")}
              </TableCell>
            </TableRow>
          )}
          {data?.map((campaign) => (
            <TableRow
              key={campaign.id}
              tabIndex={canReport ? 0 : undefined}
              onClick={() => openReport(campaign.id)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && event.key === "Enter") {
                  openReport(campaign.id);
                }
              }}
              className={cn(
                canReport &&
                  "cursor-pointer hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <TableCell className="text-sm">{campaign.name}</TableCell>
              <TableCell>
                <PhishingStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatLocalizedDate(i18n.language, campaign.sendWindow.start)} –{" "}
                {formatLocalizedDate(i18n.language, campaign.sendWindow.end)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PhishingPage() {
  const { t } = useTranslation();
  return (
    <PhishingGate>
      <PageWrapper breadcrumbs={[{ title: t("phishing.title"), href: "/phishing" }]}>
        <Campaigns />
      </PageWrapper>
    </PhishingGate>
  );
}
