import { GraduationCap, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations/useToggleCourseStudentMode";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

export function LearningModeBanner() {
  const { t } = useTranslation();
  const { course, isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);

  const handleExitLearningMode = () => toggleLearningMode({ enabled: false });

  if (!isCourseStudentModeActive) {
    return null;
  }

  return (
    <div className="bg-primary-700 p-4 text-white md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <GraduationCap className="size-5" />
          <div>
            <p className="font-semibold">{t("modernCourseView.learningMode.title")}</p>
            <p className="text-sm text-white/90">
              {t("modernCourseView.learningMode.description")}
            </p>
          </div>
        </div>
        <button
          onClick={handleExitLearningMode}
          className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-white/20 px-4 py-2 transition-colors hover:bg-white/30"
        >
          <LogOut className="size-4" />
          <span className="text-sm font-semibold">{t("modernCourseView.learningMode.exit")}</span>
        </button>
      </div>
    </div>
  );
}
