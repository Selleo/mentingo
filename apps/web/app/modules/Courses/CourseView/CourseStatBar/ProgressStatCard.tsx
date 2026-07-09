import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "~/modules/Courses/utils/formatDuration";

type ProgressStatCardProps = {
  isAdminExperience: boolean;
  onEnterLearningMode: () => void;
  timeLeftSeconds: number;
};

export default function ProgressStatCard({
  isAdminExperience,
  onEnterLearningMode,
  timeLeftSeconds,
}: ProgressStatCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`group relative flex h-full items-center rounded-2xl border-l-4 border-[#26b183] bg-white p-4 shadow-lg ${
        isAdminExperience ? "opacity-50" : ""
      }`}
    >
      <div className="flex w-full items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
          <Clock className="h-6 w-6 text-[#26b183]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-[#676767]">
            {t("modernCourseView.stats.yourProgress")}
          </p>

          <div className="mb-1.5">
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap text-xl font-bold text-[#363636]">
                {isAdminExperience ? 0 : formatDuration(timeLeftSeconds)}
              </span>
              <span className="whitespace-nowrap text-sm text-[#676767]">
                {t("modernCourseView.stats.remaining")}
              </span>
            </div>
          </div>
        </div>
      </div>
      {isAdminExperience && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="px-4 text-center text-sm font-semibold text-[#363636]">
            <button
              type="button"
              onClick={onEnterLearningMode}
              className="text-[#3f58b6] underline transition-colors hover:text-[#324a95]"
            >
              {t("modernCourseView.learningMode.enter")}
            </button>{" "}
            {t("modernCourseView.stats.trackProgress")}
          </p>
        </div>
      )}
    </div>
  );
}
