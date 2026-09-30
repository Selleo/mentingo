import { Link, useNavigate } from "@remix-run/react";
import { FolderUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  NATIVE_ARCHIVE_JOB_STATE,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LOADER_MIN_VISIBLE_MS,
} from "~/api/mutations/admin/nativeArchive.constants";
import {
  useNativeArchiveImport,
  useNativeArchiveStatus,
} from "~/api/mutations/admin/useNativeArchive";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { LEARNING_PATHS_QUERY_KEY } from "~/api/queries/useLearningPathsList";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/use-toast";
import { ScormPackageUploadField } from "~/modules/Admin/Scorm/components/ScormPackageUploadField";

import { useMinimumVisibleDuration } from "../hooks/useMinimumVisibleDuration";

type NativeArchiveImportProps = {
  cancelTo?: string;
  onCancel?: () => void;
  onComplete?: () => void;
  onWorkingChange?: (isWorking: boolean) => void;
};

export function NativeArchiveImport({
  cancelTo,
  onCancel,
  onComplete,
  onWorkingChange,
}: NativeArchiveImportProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const notifiedJobId = useRef<string | null>(null);
  const { isVisible, start, afterMinimumDuration, stop } = useMinimumVisibleDuration(
    NATIVE_ARCHIVE_LOADER_MIN_VISIBLE_MS,
  );
  const importMutation = useNativeArchiveImport();
  const status = useNativeArchiveStatus(jobId);
  const result = status.data?.result;
  const isWorking =
    isVisible ||
    importMutation.isPending ||
    Boolean(
      jobId &&
        status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.FAILED &&
        status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED &&
        !status.isError,
    );

  useEffect(() => {
    onWorkingChange?.(isWorking);
  }, [isWorking, onWorkingChange]);

  useEffect(() => {
    if (!jobId || notifiedJobId.current === jobId) return;

    if (status.data?.state === NATIVE_ARCHIVE_JOB_STATE.COMPLETED) {
      notifiedJobId.current = jobId;

      const finishImport = () => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY }),
        ]);

        toast({
          description: result?.alreadyExists
            ? t("nativeArchive.alreadyExists")
            : t("nativeArchive.importComplete", {
                count: result?.createdCourseIds?.length ?? 0,
                reused: result?.reusedCourseIds?.length ?? 0,
              }),
          variant: result?.alreadyExists ? "default" : "success",
        });

        const finishLearningPathImport = onComplete ?? (() => navigate("/development-paths"));

        match(result)
          .with({ alreadyExists: false, kind: NATIVE_ARCHIVE_KIND.COURSE }, ({ rootId }) =>
            navigate(`/course/${rootId}`),
          )
          .with({ alreadyExists: false }, finishLearningPathImport)
          .otherwise(stop);
      };

      afterMinimumDuration(finishImport);

      return;
    }

    if (status.data?.state === NATIVE_ARCHIVE_JOB_STATE.FAILED || status.isError) {
      notifiedJobId.current = jobId;
      stop();

      toast({
        description: status.isError
          ? t("nativeArchive.error")
          : t(`nativeArchive.errors.${status.data?.failedReason?.split(".").at(-1)}`, {
              defaultValue: t("nativeArchive.error"),
            }),
        variant: "destructive",
      });
    }
  }, [
    jobId,
    afterMinimumDuration,
    navigate,
    onComplete,
    result,
    status.data?.failedReason,
    status.data?.state,
    status.isError,
    stop,
    t,
    toast,
  ]);

  return (
    <section className="flex flex-col gap-5">
      <ScormPackageUploadField
        file={file ?? undefined}
        disabled={isWorking}
        readonlyTitle={file?.name}
        readonlyDescription={t("nativeArchive.importing")}
        showUploadDescription={false}
        isProcessing={isWorking}
        processingAriaLabel={
          importMutation.isPending ? t("nativeArchive.uploading") : t("nativeArchive.importing")
        }
        icon={FolderUp}
        inputAriaLabel={t("nativeArchive.selectFile")}
        labels={{
          upload: t("nativeArchive.uploadPrompt"),
          drop: t("nativeArchive.dropPrompt"),
          ready: t("nativeArchive.fileReady"),
          replace: t("nativeArchive.replaceFile"),
          remove: t("nativeArchive.removeFile"),
        }}
        onChange={(selectedFile) => {
          setFile(selectedFile);
          setJobId(null);
        }}
        onClear={() => {
          setFile(null);
          setJobId(null);
        }}
      />
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" disabled={isWorking} onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
        )}
        {cancelTo && (
          <Button asChild type="button" variant="outline">
            <Link to={cancelTo}>{t("common.button.cancel")}</Link>
          </Button>
        )}
        <Button
          type="button"
          disabled={
            !file ||
            isWorking ||
            Boolean(
              jobId && status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.FAILED && !status.isError,
            )
          }
          onClick={() => {
            if (!file) return;

            start();
            importMutation.mutate(file, {
              onSuccess: setJobId,
              onError: stop,
            });
          }}
        >
          {importMutation.isPending
            ? t("nativeArchive.uploading")
            : t("nativeArchive.importButton")}
        </Button>
      </div>
    </section>
  );
}
