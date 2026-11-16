import { Download, PackageCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { NATIVE_ARCHIVE_JOB_STATE } from "~/api/mutations/admin/nativeArchive.constants";
import { useExportScormCourse } from "~/api/mutations/admin/useExportScormCourse";
import {
  downloadNativeArchive,
  useNativeArchiveStatus,
} from "~/api/mutations/admin/useNativeArchive";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/use-toast";
import { NativeArchiveJobProgress } from "~/modules/Admin/components/NativeArchiveJobProgress";

import { SCORM_EXPORT_CARD_HANDLES } from "../../../../../e2e/data/courses/handles";

import type { SupportedLanguages } from "@repo/shared";

type ScormExportCardProps = {
  courseId: string;
  language: SupportedLanguages;
  unsupportedLessonCount: number;
};

export const ScormExportCard = ({
  courseId,
  language,
  unsupportedLessonCount,
}: ScormExportCardProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const downloadedJobId = useRef<string | null>(null);
  const { mutate: exportScormCourse, isPending: isEnqueueing } = useExportScormCourse();
  const { data: jobStatus } = useNativeArchiveStatus(jobId);
  const isJobFinished =
    jobStatus?.state === NATIVE_ARCHIVE_JOB_STATE.COMPLETED ||
    jobStatus?.state === NATIVE_ARCHIVE_JOB_STATE.FAILED;
  const isJobRunning = Boolean(jobId) && !isJobFinished;
  const isPending = isEnqueueing || isJobRunning;
  const hasUnsupportedLessons = unsupportedLessonCount > 0;
  const fallbackErrorMessage = t("adminCourseView.scormExport.error.fallback");

  useEffect(() => {
    if (!jobId || downloadedJobId.current === jobId) return;

    if (jobStatus?.state === NATIVE_ARCHIVE_JOB_STATE.FAILED) {
      downloadedJobId.current = jobId;
      toast({
        description: t(jobStatus.failedReason ?? "", { defaultValue: fallbackErrorMessage }),
        variant: "destructive",
      });
      return;
    }

    if (jobStatus?.state !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED) return;

    downloadedJobId.current = jobId;
    void downloadNativeArchive(jobId)
      .then(() => toast({ description: t("adminCourseView.scormExport.success") }))
      .catch(() => toast({ description: fallbackErrorMessage, variant: "destructive" }));
  }, [fallbackErrorMessage, jobId, jobStatus?.failedReason, jobStatus?.state, t, toast]);

  const handleExport = () =>
    exportScormCourse({ courseId, language }, { onSuccess: (nextJobId) => setJobId(nextJobId) });
  const buttonLabel = isPending
    ? t("adminCourseView.scormExport.exportingButton")
    : t("adminCourseView.scormExport.button");

  return (
    <Card data-testid={SCORM_EXPORT_CARD_HANDLES.ROOT} className="border-neutral-200 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-6 pb-4 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-900">
            <PackageCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-semibold text-neutral-950">
              {t("adminCourseView.scormExport.title")}
            </CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-neutral-700">
              {t("adminCourseView.scormExport.description")}
            </p>
          </div>
        </div>
        <Badge variant="secondaryWithOutline" className="shrink-0">
          {t("adminCourseView.scormExport.versionBadge")}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col items-end gap-3 px-6 pb-6">
        <div className="flex justify-end">
          {hasUnsupportedLessons ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  data-testid={SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  {buttonLabel}
                </Button>
              </DialogTrigger>
              <DialogContent data-testid={SCORM_EXPORT_CARD_HANDLES.WARNING_DIALOG}>
                <DialogTitle>{t("adminCourseView.scormExport.warning.title")}</DialogTitle>
                <DialogDescription>
                  {t("adminCourseView.scormExport.warning.description", {
                    count: unsupportedLessonCount,
                  })}
                </DialogDescription>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid={SCORM_EXPORT_CARD_HANDLES.WARNING_CANCEL_BUTTON}
                    >
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      data-testid={SCORM_EXPORT_CARD_HANDLES.WARNING_CONFIRM_BUTTON}
                      onClick={handleExport}
                    >
                      {t("adminCourseView.scormExport.warning.confirm")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              type="button"
              data-testid={SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON}
              disabled={isPending}
              className="gap-2"
              onClick={handleExport}
            >
              <Download className="size-4" />
              {buttonLabel}
            </Button>
          )}
        </div>
        {isJobRunning && (
          <NativeArchiveJobProgress className="max-w-sm" progress={jobStatus?.progress} />
        )}
      </CardContent>
    </Card>
  );
};
