import { CheckCircle2, Circle, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CHAPTER_PROGRESS_STATUSES } from "../lessonTypes";

type LessonStatusIconProps = {
  status: string;
};

export default function LessonStatusIcon({ status }: LessonStatusIconProps) {
  const { t } = useTranslation();

  if (status === CHAPTER_PROGRESS_STATUSES.COMPLETED) {
    return (
      <div className="relative group/status">
        <CheckCircle2 className="size-5 text-success-500" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.completed")}
        </div>
      </div>
    );
  }

  if (status === CHAPTER_PROGRESS_STATUSES.IN_PROGRESS) {
    return (
      <div className="relative group/status">
        <Circle className="size-4 fill-current text-secondary-500" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.inProgress")}
        </div>
      </div>
    );
  }

  if (status === CHAPTER_PROGRESS_STATUSES.NOT_STARTED) {
    return (
      <div className="relative group/status">
        <Minus className="size-5 text-neutral-800" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.notStarted")}
        </div>
      </div>
    );
  }

  return null;
}
