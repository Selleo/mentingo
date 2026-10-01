import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { NATIVE_ARCHIVE_JOB_STATE } from "~/api/mutations/admin/nativeArchive.constants";
import {
  downloadNativeArchive,
  useNativeArchiveExport,
  useNativeArchiveStatus,
} from "~/api/mutations/admin/useNativeArchive";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/use-toast";

import type { NativeArchiveExportRequest } from "~/api/mutations/admin/nativeArchive.types";

type NativeArchiveExportButtonProps = NativeArchiveExportRequest;

export function NativeArchiveExportButton({ kind, id }: NativeArchiveExportButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const completedJob = useRef<string | null>(null);
  const exportMutation = useNativeArchiveExport();
  const status = useNativeArchiveStatus(jobId);

  useEffect(() => {
    if (
      !jobId ||
      status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED ||
      completedJob.current === jobId
    )
      return;
    completedJob.current = jobId;
    void downloadNativeArchive(jobId)
      .then(() => {
        toast({ description: t("nativeArchive.exportReady") });
      })
      .catch(() => {
        toast({ description: t("nativeArchive.error"), variant: "destructive" });
      });
  }, [jobId, status.data?.state, t, toast]);

  const isWorking =
    exportMutation.isPending ||
    (Boolean(jobId) &&
      status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED &&
      status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.FAILED);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="gap-2"
        disabled={isWorking}
        onClick={() => {
          exportMutation.mutate(
            { kind, id },
            {
              onSuccess: (nextJobId) => {
                completedJob.current = null;
                setJobId(nextJobId);
              },
              onError: () =>
                toast({ description: t("nativeArchive.error"), variant: "destructive" }),
            },
          );
        }}
      >
        <Download className="size-4" />
        {isWorking ? t("nativeArchive.preparing") : t("nativeArchive.exportButton")}
      </Button>
      {status.data?.state === NATIVE_ARCHIVE_JOB_STATE.FAILED && (
        <p className="text-sm text-red-600">
          {t(`nativeArchive.errors.${status.data.failedReason?.split(".").at(-1)}`, {
            defaultValue: t("nativeArchive.error"),
          })}
        </p>
      )}
    </div>
  );
}
