import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkArchiveCourse } from "~/api/mutations/admin/useBulkArchiveCourse";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import { COURSE_SETTINGS_HANDLES } from "../../../../../e2e/data/courses/handles";

type CourseArchiveSettingProps = {
  courseId: string;
  isArchived: boolean;
};

export default function CourseArchiveSetting({ courseId, isArchived }: CourseArchiveSettingProps) {
  const { t } = useTranslation();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const { mutate: updateArchiveState, isPending } = useBulkArchiveCourse();

  const handleAction = () => {
    if (!isArchived) {
      setIsConfirmationOpen(true);
      return;
    }

    updateArchiveState({ ids: [courseId], isArchived: false });
  };

  return (
    <>
      <section className="flex w-full flex-col gap-3 border-t border-neutral-200 pt-5">
        <h3 className="text-base font-semibold text-neutral-950">
          {t("adminCourseView.settings.other.courseAvailabilityTitle")}
        </h3>
        <div className="flex w-full flex-col gap-4 rounded-lg border border-neutral-300 bg-neutral-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600">
              {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-neutral-950">
                {isArchived
                  ? t("adminCourseView.settings.other.archivedCourseTitle")
                  : t("adminCourseView.settings.other.archiveCourseTitle")}
              </h4>
              <p className="mt-1 text-sm leading-5 text-neutral-700">
                {t("adminCourseView.settings.other.archiveCourseDescription")}
              </p>
            </div>
          </div>
          <Button
            data-testid={COURSE_SETTINGS_HANDLES.ARCHIVE_ACTION_BUTTON}
            type="button"
            variant="outline"
            className={cn("shrink-0 self-start sm:self-center", {
              "border-error-300 text-error-700 hover:border-error-500 hover:bg-error-50 hover:text-error-700":
                !isArchived,
            })}
            disabled={isPending}
            onClick={handleAction}
          >
            {isArchived
              ? t("adminCoursesView.dropdown.restore")
              : t("adminCoursesView.dropdown.archive")}
          </Button>
        </div>
      </section>

      <Dialog
        open={isConfirmationOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsConfirmationOpen(open);
        }}
      >
        <DialogContent data-testid={COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_DIALOG}>
          <DialogHeader>
            <DialogTitle>{t("adminCoursesView.dropdown.archive")}</DialogTitle>
            <DialogDescription>
              {t("adminCourseView.settings.other.archiveCourseDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                data-testid={COURSE_SETTINGS_HANDLES.ARCHIVE_CANCEL_BUTTON}
                disabled={isPending}
              >
                {t("common.button.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              data-testid={COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_BUTTON}
              className="bg-error-500 text-white hover:bg-error-600"
              disabled={isPending}
              onClick={() =>
                updateArchiveState(
                  { ids: [courseId], isArchived: true },
                  { onSuccess: () => setIsConfirmationOpen(false) },
                )
              }
            >
              {t("adminCoursesView.dropdown.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
