import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

// 24 hours expressed in milliseconds.
const MILLISECONDS_PER_DAY = 86_400_000;

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
    ? Math.max(0, Math.ceil((new Date(dueDate).getTime() - Date.now()) / MILLISECONDS_PER_DAY))
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
      className={cn("relative overflow-hidden rounded-2xl bg-white p-4 pl-6 text-left shadow-sm", {
        "cursor-pointer transition-all hover:bg-neutral-50 hover:shadow-xl": isAdminExperience,
        "opacity-50 hover:bg-neutral-100 hover:opacity-75": isAdminExperience && !hasDeadline,
      })}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-secondary-500" aria-hidden="true" />
      <div className="flex items-center gap-4">
        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
          <Calendar className="size-6 text-secondary-500" />
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
