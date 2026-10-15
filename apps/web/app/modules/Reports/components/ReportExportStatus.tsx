import { AlertCircle, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { GetReportExportResponse } from "~/api/generated-api";

type ReportExport = GetReportExportResponse["data"];

type ReportExportStatusProps = {
  reportExport: ReportExport;
  isDownloading: boolean;
  onDownload: () => void;
  onDismiss: () => void;
};

type StatusAppearance = {
  icon: LucideIcon;
  title: string;
  description: string;
  cardClassName: string;
  iconClassName: string;
};

export function ReportExportStatus({
  reportExport,
  isDownloading,
  onDownload,
  onDismiss,
}: ReportExportStatusProps) {
  const { t } = useTranslation();
  const format = reportExport.format.toUpperCase();
  const isReady = reportExport.status === "completed";
  const isFinished = isReady || reportExport.status === "failed";

  const appearance = match(reportExport.status)
    .returnType<StatusAppearance>()
    .with("completed", () => ({
      icon: CheckCircle2,
      title: t("reports.exports.ready", { format }),
      description: t("reports.exports.readyDescription"),
      cardClassName: "border-success-200 bg-success-50",
      iconClassName: "bg-success-100 text-success-700",
    }))
    .with("failed", () => ({
      icon: AlertCircle,
      title: t(reportExport.failureCode ?? "reports.exports.failed"),
      description: t("reports.exports.failedDescription"),
      cardClassName: "border-error-200 bg-error-50",
      iconClassName: "bg-error-100 text-error-700",
    }))
    .otherwise(() => ({
      icon: Loader2,
      title: t("reports.exports.processing"),
      description: t("reports.exports.processingDescription"),
      cardClassName: "border-primary-200 bg-primary-50",
      iconClassName: "bg-primary-100 text-primary-700 [&>svg]:animate-spin",
    }));
  const StatusIcon = appearance.icon;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 shadow-sm duration-300 animate-in fade-in slide-in-from-top-2",
        appearance.cardClassName,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          appearance.iconClassName,
        )}
      >
        <StatusIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="body-sm-md text-neutral-950">{appearance.title}</p>
        <p className="details text-neutral-600">{appearance.description}</p>
      </div>
      <div className="flex items-center gap-1">
        {isReady && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 bg-white"
            disabled={isDownloading}
            onClick={onDownload}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("reports.exports.download")}
          </Button>
        )}
        {isFinished && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 text-neutral-500 hover:text-neutral-900"
            aria-label={t("reports.exports.dismiss")}
            onClick={onDismiss}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
