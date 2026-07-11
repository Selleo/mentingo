import { GraduationCap, Info, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

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
        <button
          type="button"
          disabled={isTogglingLearningMode}
          onClick={onToggleLearningMode}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-white shadow-2xl transition hover:bg-primary-800 disabled:opacity-50"
        >
          <GraduationCap className="size-4" />

          <span className="text-sm font-semibold">{t("modernCourseView.learningMode.enter")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinueLearning}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-white shadow-2xl transition hover:bg-primary-800"
        >
          <Play className="size-4" fill="currentColor" />

          <span className="text-sm font-semibold">
            {t("modernCourseView.overview.continueLearning")}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onOpenDetails}
        className="flex items-center gap-2 rounded-lg border-2 border-white/40 px-4 py-2 text-white backdrop-blur-sm transition hover:bg-white/20"
      >
        <Info className="size-4" />

        <span className="text-sm font-semibold">
          {t("modernCourseView.overview.courseDetails")}
        </span>
      </button>
    </div>
  );
}
