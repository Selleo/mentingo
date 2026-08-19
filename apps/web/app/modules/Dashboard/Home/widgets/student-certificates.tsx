import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";
import { Award } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDashboardCertificates } from "~/api/queries/useDashboardCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { CertificatePreviewModal } from "~/modules/Profile/Certificates/CertificatePreviewModal";
import { formatCertificateDate } from "~/utils/formatCertificateDate";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { DashboardWidgetSize } from "../types";

export function WidgetStudentCertificates({
  widgetSize = DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
}: {
  widgetSize?: DashboardWidgetSize;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [page, setPage] = useState(1);
  const [certificates, setCertificates] = useState<
    NonNullable<ReturnType<typeof useDashboardCertificates>["data"]>["data"]
  >([]);
  const [selectedCertificate, setSelectedCertificate] = useState<
    (typeof certificates)[number] | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.CERTIFICATES];
  const isCompact = widgetSize === DASHBOARD_WIDGET_SIZES.TWO_BY_ONE;
  const { data, isLoading, isError, isFetching, refetch } = useDashboardCertificates(page, true);
  const { data: globalSettings } = useGlobalSettings();
  const hasMore = Boolean(
    data && data.pagination.page * data.pagination.perPage < data.pagination.totalItems,
  );
  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value))
      : undefined;

  useEffect(() => {
    setPage(1);
    setCertificates([]);
  }, [language]);

  useEffect(() => {
    if (!data?.data) return;
    setCertificates((current) => {
      if (page === 1) return data.data;
      const knownIds = new Set(current.map((certificate) => certificate.id));
      return [...current, ...data.data.filter((certificate) => !knownIds.has(certificate.id))];
    });
  }, [data, page]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element || !hasMore || isFetching) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 80)
      setPage((current) => current + 1);
  };

  return (
    <>
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES}>
        <DashboardWidgetHeader title={t(metadata.titleKey)} icon={metadata.icon} />
        <DashboardWidgetContent>
          {isLoading && certificates.length === 0 ? (
            <DashboardWidgetQueryState isLoading isError={false} onRetry={() => void refetch()} />
          ) : isError ? (
            <DashboardWidgetQueryState isLoading={false} isError onRetry={() => void refetch()} />
          ) : certificates.length === 0 ? (
            <div
              className={cn(
                "flex h-full items-center justify-center px-4 text-center text-neutral-600",
                !isCompact && "min-h-32",
              )}
            >
              {t("dashboardHome.widgets.studentTiles.certificates.empty")}
            </div>
          ) : (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className={cn(
                "h-full min-h-0 overflow-y-auto",
                isCompact ? "space-y-1 p-2" : "space-y-2 p-3",
              )}
            >
              {certificates.map((certificate) => (
                <Button
                  key={certificate.id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "group flex h-auto w-full items-center justify-start rounded-lg border border-neutral-100 text-left hover:border-primary-200 hover:bg-primary-50",
                    isCompact ? "gap-2 p-2" : "gap-3 p-3",
                  )}
                  onClick={() => setSelectedCertificate(certificate)}
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700",
                      isCompact ? "size-8" : "size-9",
                    )}
                  >
                    <Award className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="body-sm-md block truncate text-neutral-950">
                      {certificate.courseTitle ??
                        t("dashboardHome.widgets.studentTiles.certificates.title")}
                    </span>
                    <span className="details block truncate text-neutral-500">
                      {formatDate(certificate.completionDate ?? certificate.issuedAt)}
                    </span>
                  </span>
                </Button>
              ))}
              {isFetching && (
                <p className="details px-2 py-2 text-center text-neutral-500">
                  {t("common.button.loading")}
                </p>
              )}
            </div>
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>

      <CertificatePreviewModal
        open={Boolean(selectedCertificate)}
        onOpenChange={(open) => {
          if (!open) setSelectedCertificate(null);
        }}
        studentName={selectedCertificate?.fullName ?? undefined}
        courseName={selectedCertificate?.courseTitle ?? undefined}
        completionDate={formatCertificateDate(
          selectedCertificate?.completionDate ?? selectedCertificate?.issuedAt,
        )}
        expiryDate={formatCertificateDate(selectedCertificate?.expiresAt) || undefined}
        platformLogo={globalSettings?.platformLogoS3Key}
        certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
        certificateSignatureUrl={selectedCertificate?.certificateSignatureUrl}
        certificateId={selectedCertificate?.id}
        initialColor={selectedCertificate?.certificateFontColor}
        showShareButton={Boolean(selectedCertificate?.id)}
      />
    </>
  );
}
