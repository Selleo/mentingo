import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { CourseSettingsSwitches } from "~/modules/Admin/EditCourse/CourseSettings/components/CourseSettingsSwitches";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

type CourseSettingsDrawerProps = {
  courseId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export default function CourseSettingsDrawer({
  courseId,
  onOpenChange,
  open,
  title,
}: CourseSettingsDrawerProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid={COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER}
        className="w-full p-0 sm:max-w-md"
      >
        <div className="flex h-dvh flex-col">
          <div className="border-b border-neutral-200 p-4 pr-14 md:p-6 md:pr-14">
            <SheetHeader className="space-y-0 text-left">
              <div className="flex items-center gap-3">
                <Settings className="size-6 text-primary-700" />
                <SheetTitle className="font-gothic text-2xl font-bold text-neutral-950">
                  {title}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">
                {t("modernCourseView.overview.settingsDescription")}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <CourseSettingsSwitches courseId={courseId} />
          </div>

          <SheetFooter className="border-t border-neutral-200 p-4 md:p-6">
            <SheetClose asChild>
              <Button className="w-full">{t("modernCourseView.common.close")}</Button>
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
