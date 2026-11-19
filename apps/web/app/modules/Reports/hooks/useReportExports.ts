import { useEffect, useRef, useState } from "react";

import { useCreateReportExport } from "~/api/mutations/useCreateReportExport";
import { useDownloadReportExport } from "~/api/mutations/useDownloadReportExport";
import { useReportExportStatus } from "~/api/queries/useReportExportStatus";

import type { ReportExportFormat, ReportsQuery } from "../types/reports-api.types";
import type { SupportedLanguages } from "@repo/shared";

const getExportFileName = (format: string) => `mentingo-report.${format}`;

/** Starts report exports and downloads each one once, as soon as it completes. */
export function useReportExports(language: SupportedLanguages) {
  const [exportId, setExportId] = useState<string>();
  const autoDownloadedExportIdRef = useRef<string>();
  const { mutateAsync: createExport, isPending: isExporting } = useCreateReportExport();
  const { mutateAsync: downloadExport, isPending: isDownloading } = useDownloadReportExport();
  const { data: activeExport } = useReportExportStatus(exportId);

  useEffect(() => {
    if (activeExport?.status !== "completed") return;
    if (autoDownloadedExportIdRef.current === activeExport.id) return;

    autoDownloadedExportIdRef.current = activeExport.id;
    void downloadExport({ id: activeExport.id, fileName: getExportFileName(activeExport.format) });
  }, [activeExport, downloadExport]);

  const startExport = async (format: ReportExportFormat, query: ReportsQuery) => {
    const exported = await createExport({ format, language, query });
    setExportId(exported.id);
  };

  const downloadCompletedExport = async () => {
    if (!activeExport || activeExport.status !== "completed") return;
    await downloadExport({ id: activeExport.id, fileName: getExportFileName(activeExport.format) });
  };

  return {
    activeExport,
    isExporting,
    isDownloading,
    startExport,
    downloadCompletedExport,
    dismissExport: () => setExportId(undefined),
  };
}
