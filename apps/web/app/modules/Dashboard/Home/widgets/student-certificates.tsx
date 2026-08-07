import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { Award, CalendarDays, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCertificateDashboardSummary } from "~/api/queries/useCertificateDashboardSummary";
import { useDashboardCertificates } from "~/api/queries/useDashboardCertificates";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";

export function WidgetStudentCertificates() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data, isLoading, isError, refetch } = useCertificateDashboardSummary();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES];
  const {
    data: certificatesResponse,
    isLoading: areCertificatesLoading,
    isError: areCertificatesError,
    refetch: refetchCertificates,
  } = useDashboardCertificates(page, isDialogOpen);
  const certificates = certificatesResponse?.data ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil(
      (certificatesResponse?.pagination.totalItems ?? 0) /
        (certificatesResponse?.pagination.perPage ?? 10),
    ),
  );
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value));
  const openDialog = () => {
    setPage(1);
    setIsDialogOpen(true);
  };

  return (
    <>
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES}>
        <DashboardWidgetHeader
          title={t(metadata.titleKey)}
          icon={metadata.icon}
          iconClassName={metadata.iconClassName}
          iconContainerClassName={metadata.iconContainerClassName}
        />
        <DashboardWidgetContent>
          {isLoading || isError ? (
            <DashboardWidgetQueryState
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
            />
          ) : data?.activeCount === 0 ? (
            <div className="flex min-h-32 items-center justify-center text-center text-neutral-600">
              {t("dashboardHome.widgets.studentTiles.certificates.empty")}
            </div>
          ) : (
            data && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openDialog}
                  className="group flex w-full items-center gap-3 rounded-lg border border-purple-100 bg-purple-50 p-4 text-left transition-colors hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="h4 text-purple-700">{data.activeCount}</p>
                    <p className="body-sm-md text-purple-800">
                      {t("dashboardHome.widgets.studentTiles.certificates.active")}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-5 text-purple-500 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
                {data.expiringSoon && (
                  <div className="rounded-lg border border-warning-100 bg-warning-50 p-4">
                    <div className="flex items-center gap-2 text-warning-800">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      <p className="body-sm-md">
                        {t("dashboardHome.widgets.studentTiles.certificates.expiringSoon")}
                      </p>
                    </div>
                    <p className="mt-2 line-clamp-2 font-medium text-neutral-950">
                      {data.expiringSoon.courseTitle}
                    </p>
                    <p className="details mt-1 text-warning-700">
                      {formatDate(data.expiringSoon.expiresAt)}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link
                        to={`/course/${data.expiringSoon.courseSlug}?certificate=${data.expiringSoon.certificateId}`}
                      >
                        {t("dashboardHome.widgets.studentTiles.certificates.cta")}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent variant="mobileDrawer" className="flex flex-col sm:!max-w-2xl">
          <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
            <DialogTitle>
              {t("dashboardHome.widgets.studentTiles.certificates.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboardHome.widgets.studentTiles.certificates.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          {areCertificatesLoading || areCertificatesError ? (
            <DashboardWidgetQueryState
              isLoading={areCertificatesLoading}
              isError={areCertificatesError}
              onRetry={() => void refetchCertificates()}
              className="min-h-48 p-6"
            />
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
                {certificates.map((certificate) => (
                  <Link
                    key={certificate.id}
                    to={`/course/${certificate.courseId}?certificate=${certificate.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-neutral-100 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                      <Award className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="body-sm-md line-clamp-1 text-neutral-950">
                        {certificate.courseTitle}
                      </p>
                      <p className="details mt-1 text-neutral-500">
                        {t("dashboardHome.widgets.studentTiles.certificates.issued", {
                          date: formatDate(
                            certificate.completionDate ??
                              certificate.issuedAt ??
                              certificate.createdAt,
                          ),
                        })}
                      </p>
                      <p className="details mt-0.5 text-neutral-500">
                        {certificate.expiresAt
                          ? t("dashboardHome.widgets.studentTiles.certificates.expires", {
                              date: formatDate(certificate.expiresAt),
                            })
                          : t("dashboardHome.widgets.studentTiles.certificates.noExpiry")}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {t("dashboardHome.widgets.studentTiles.certificates.previous")}
                  </Button>
                  <span className="details text-neutral-500">
                    {t("dashboardHome.widgets.studentTiles.certificates.page", {
                      page,
                      totalPages,
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    {t("dashboardHome.widgets.studentTiles.certificates.next")}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
