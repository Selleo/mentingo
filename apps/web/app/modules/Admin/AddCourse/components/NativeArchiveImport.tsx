import { useNavigate } from "@remix-run/react";
import { FolderUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { ScormPackageUploadField } from "~/modules/Admin/Scorm/components/ScormPackageUploadField";

import { useMinimumVisibleDuration } from "../hooks/useMinimumVisibleDuration";

export function NativeArchiveImport() {
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

        if (result && !result.alreadyExists) {
          navigate(
            result.kind === NATIVE_ARCHIVE_KIND.COURSE
              ? `/course/${result.rootId}`
              : "/development-paths",
          );
        } else {
          stop();
        }
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
    result,
    status.data?.failedReason,
    status.data?.state,
    status.isError,
    stop,
    t,
    toast,
  ]);

  const isWorking =
    isVisible ||
    importMutation.isPending ||
    Boolean(
      jobId &&
        status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.FAILED &&
        status.data?.state !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED &&
        !status.isError,
    );

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Label className="body-base-md">{t("nativeArchive.selectFile")}</Label>
        <p className="body-sm mb-3 mt-1 text-neutral-700">{t("nativeArchive.importDescription")}</p>
        <ScormPackageUploadField
          file={file ?? undefined}
          disabled={isWorking}
          readonlyTitle={file?.name}
          readonlyDescription={t("nativeArchive.importing")}
          isProcessing={isWorking}
          processingAriaLabel={
            importMutation.isPending ? t("nativeArchive.uploading") : t("nativeArchive.importing")
          }
          icon={FolderUp}
          inputAriaLabel={t("nativeArchive.selectFile")}
          labels={{
            upload: t("nativeArchive.uploadPrompt"),
            uploadDescription: t("nativeArchive.uploadDescription"),
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
      </div>
      <div className="flex justify-end">
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
