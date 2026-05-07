import { Download, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExportScormCourse } from "~/api/mutations/admin/useExportScormCourse";
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
  const { mutate: exportScormCourse, isPending } = useExportScormCourse();
  const hasUnsupportedLessons = unsupportedLessonCount > 0;
  const handleExport = () => exportScormCourse({ courseId, language });
  const buttonLabel = isPending
    ? t("adminCourseView.scormExport.exportingButton")
    : t("adminCourseView.scormExport.button");

  return (
    <Card className="border-neutral-200 shadow-sm">
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
      <CardContent className="flex justify-end px-6 pb-6">
        <div className="flex justify-end">
          {hasUnsupportedLessons ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" disabled={isPending} className="gap-2">
                  <Download className="size-4" />
                  {buttonLabel}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>{t("adminCourseView.scormExport.warning.title")}</DialogTitle>
                <DialogDescription>
                  {t("adminCourseView.scormExport.warning.description", {
                    count: unsupportedLessonCount,
                  })}
                </DialogDescription>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button type="button" onClick={handleExport}>
                      {t("adminCourseView.scormExport.warning.confirm")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button type="button" disabled={isPending} className="gap-2" onClick={handleExport}>
              <Download className="size-4" />
              {buttonLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
