import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";

type LearningModeBannerProps = {
  className?: string;
};

export function LearningModeBanner({ className }: LearningModeBannerProps) {
  const { t } = useTranslation();
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { course, isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);

  if (!canManageCourses || !isCourseStudentModeActive) return null;

  const handleExitLearningMode = () => toggleLearningMode({ enabled: false });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 bg-primary-700 px-6 py-5 text-primary-50 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-600">
          <Icon name="Hat" className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="body-lg-md">{t("studentCourseView.studentMode.bannerTitle")}</p>
          <p className="body-base-md">{t("studentCourseView.studentMode.bannerDescription")}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={handleExitLearningMode}
        disabled={isTogglingLearningMode}
      >
        <Icon name="X" className="size-2.5" />
        {t("studentCourseView.studentMode.exitBanner", "Exit learning mode")}
      </Button>
    </div>
  );
}
