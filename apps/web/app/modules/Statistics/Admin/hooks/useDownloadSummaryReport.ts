import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import {
  extractFilenameFromContentDisposition,
  triggerBrowserDownload,
} from "~/utils/downloadFile";

import type { AxiosResponse } from "axios";

export function useDownloadSummaryReport() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadReport = async () => {
    setIsDownloading(true);

    try {
      const response = (await ApiClient.api.reportControllerDownloadSummaryReport(
        { language },
        { format: "blob" },
      )) as unknown as AxiosResponse<Blob>;

      const filename =
        extractFilenameFromContentDisposition(response.headers["content-disposition"]) ||
        "summary-report.xlsx";

      triggerBrowserDownload(response.data, filename);

      toast({ description: t("adminStatisticsView.toast.reportDownloadSuccess") });
    } catch (error) {
      toast({
        description: t("adminStatisticsView.toast.reportDownloadError"),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return { downloadReport, isDownloading };
}
