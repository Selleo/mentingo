import { GraduationCap, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations/useToggleCourseStudentMode";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

export function LearningModeBannerNew() {
  const { t } = useTranslation();
  const { course, isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);

  const handleExitLearningMode = () => toggleLearningMode({ enabled: false });

  if (!isCourseStudentModeActive) {
    return null;
  }

  return (
    <div className="bg-[#3f58b6] text-white py-4 px-4 md:px-8">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5" />
          <div>
            <p className="font-semibold">{t("modernCourseView.learningMode.title")}</p>
            <p className="text-sm text-white/90">
              {t("modernCourseView.learningMode.description")}
            </p>
          </div>
        </div>
        <button
          onClick={handleExitLearningMode}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-semibold">{t("modernCourseView.learningMode.exit")}</span>
        </button>
      </div>
    </div>
  );
}
