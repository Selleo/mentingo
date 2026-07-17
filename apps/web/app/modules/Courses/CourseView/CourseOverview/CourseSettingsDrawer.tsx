import { Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { CourseSettingsSwitches } from "~/modules/Admin/EditCourse/CourseSettings/components/CourseSettingsSwitches";

type CourseSettingsDrawerProps = {
  onClose: () => void;
  title: string;
  courseId: string;
};

export default function CourseSettingsDrawer({
  onClose,
  title,
  courseId,
}: CourseSettingsDrawerProps) {
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        aria-label={t("modernCourseView.overview.closeSettings")}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 z-50 size-full bg-white shadow-2xl transition-transform sm:max-w-md">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <Settings className="size-6 text-primary-700" />
              <h2 className="font-gothic text-2xl font-bold text-neutral-950">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-neutral-100"
            >
              <X className="size-5 text-neutral-800" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <CourseSettingsSwitches courseId={courseId} />
          </div>

          <div className="border-t border-neutral-200 p-4 md:p-6">
            <Button onClick={onClose} className="w-full">
              {t("modernCourseView.common.close")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
