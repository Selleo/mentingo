import { GraduationCap, Info, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

type CourseOverviewActionsProps = {
  isTogglingLearningMode: boolean;
  onContinueLearning: () => void;
  onOpenDetails: () => void;
  onToggleLearningMode: () => void;
};

export default function CourseOverviewActions({
  isTogglingLearningMode,
  onContinueLearning,
  onOpenDetails,
  onToggleLearningMode,
}: CourseOverviewActionsProps) {
  const { t } = useTranslation();
  const { isAdminExperience } = useCourseAccessProvider();

  return (
    <div className="hidden flex-wrap items-center gap-3 md:flex">
      {isAdminExperience ? (
        <Button
          disabled={isTogglingLearningMode}
          onClick={onToggleLearningMode}
          className="flex items-center gap-2 shadow-2xl transition disabled:opacity-50"
        >
          <GraduationCap className="size-4" />

          <span className="text-sm font-semibold">{t("modernCourseView.learningMode.enter")}</span>
        </Button>
      ) : (
        <Button onClick={onContinueLearning} className="flex items-center gap-2 shadow-2xl">
          <Play className="size-4" fill="currentColor" />

          <span className="text-sm font-semibold">
            {t("modernCourseView.overview.continueLearning")}
          </span>
        </Button>
      )}

      <Button
        variant="outline"
        onClick={onOpenDetails}
        className="flex items-center gap-2 backdrop-blur-sm transition "
      >
        <Info className="size-4" />

        <span className="text-sm font-semibold">
          {t("modernCourseView.overview.courseDetails")}
        </span>
      </Button>
    </div>
  );
}
