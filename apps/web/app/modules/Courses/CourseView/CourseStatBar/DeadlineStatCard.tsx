import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

type DeadlineStatCardProps = {
  dueDate?: string | null;
  hasDeadline?: boolean;
  isAdminExperience: boolean;
  onOpen: () => void;
};

export default function DeadlineStatCard({
  dueDate,
  hasDeadline,
  isAdminExperience,
  onOpen,
}: DeadlineStatCardProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={!isAdminExperience}
      onClick={() => {
        if (isAdminExperience) {
          onOpen();
        }
      }}
      className={`rounded-2xl border-l-4 border-[#D4705D] bg-white p-4 text-left shadow-lg ${
        isAdminExperience
          ? "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#D4705D]/40"
          : ""
      } ${isAdminExperience && !hasDeadline ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
          <Calendar className="h-6 w-6 text-[#D4705D]" />
        </div>
        <div className="flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-[#676767]">
            {t("modernCourseView.stats.deadline")}
          </p>
          {isAdminExperience ? (
            <p className="text-xl font-bold text-[#363636]">
              {hasDeadline
                ? t("modernCourseView.common.enabled")
                : t("modernCourseView.common.disabled")}
            </p>
          ) : (
            <>
              <p className="text-xl font-bold text-[#363636]">
                {t("modernCourseView.stats.daysLeft", { count: 9 })}
              </p>
              <p className="text-xs text-[#676767]">{dueDate}</p>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
