import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

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
  const daysLeft = dueDate
    ? Math.max(0, Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000))
    : 0;
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : null;

  return (
    <button
      type="button"
      disabled={!isAdminExperience}
      onClick={() => {
        if (isAdminExperience) {
          onOpen();
        }
      }}
      className={cn(
        "rounded-2xl border-l-4 border-secondary-500 bg-white p-4 text-left shadow-lg",
        {
          "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:outline hover:outline-2 hover:outline-dashed hover:outline-secondary-500/40":
            isAdminExperience,
          "opacity-50": isAdminExperience && !hasDeadline,
        },
      )}
    >
      <div className="flex items-start gap-4">
        <div className="mt-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
          <Calendar className="h-6 w-6 text-secondary-500" />
        </div>
        <div className="flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.deadline")}
          </p>
          {isAdminExperience ? (
            <p className="text-xl font-bold text-neutral-950">
              {hasDeadline
                ? t("modernCourseView.common.enabled")
                : t("modernCourseView.common.disabled")}
            </p>
          ) : (
            <>
              <p className="text-xl font-bold text-neutral-950">
                {t("modernCourseView.stats.daysLeft", { count: daysLeft })}
              </p>
              <p className="text-xs text-neutral-800">{formattedDueDate}</p>
            </>
          )}
          {isAdminExperience && formattedDueDate && (
            <p className="text-xs text-neutral-800">{formattedDueDate}</p>
          )}
        </div>
      </div>
    </button>
  );
}
