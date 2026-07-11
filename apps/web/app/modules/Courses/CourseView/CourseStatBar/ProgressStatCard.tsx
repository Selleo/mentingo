import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
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
    <div className="group relative flex h-full items-center overflow-hidden rounded-2xl border-l-4 border-success-500 bg-white p-4 shadow-lg">
      <div
        className={cn("flex w-full items-center gap-4 transition-all duration-200", {
          "opacity-45 group-hover:scale-[0.98] group-hover:blur-[2px]": isAdminExperience,
        })}
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-success-50">
          <Clock className="h-6 w-6 text-success-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.yourProgress")}
          </p>

          <div className="mb-1.5">
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap text-xl font-bold text-neutral-950">
                {isAdminExperience ? 0 : formatDuration(timeLeftSeconds)}
              </span>
              <span className="whitespace-nowrap text-sm text-neutral-800">
                {t("modernCourseView.stats.remaining")}
              </span>
            </div>
          </div>
        </div>
      </div>
      {isAdminExperience && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-950/35 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <p className="mx-3 rounded-xl border border-white/70 bg-white/95 px-4 py-3 text-center text-sm font-semibold text-neutral-950 shadow-lg">
            <button
              type="button"
              onClick={onEnterLearningMode}
              className="text-primary-700 underline transition-colors hover:text-primary-800"
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
