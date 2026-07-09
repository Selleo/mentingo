import { CheckCircle2, Circle, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";

type LessonStatusIconProps = {
  status: string;
};

export default function LessonStatusIcon({ status }: LessonStatusIconProps) {
  const { t } = useTranslation();

  if (status === "completed") {
    return (
      <div className="relative group/status">
        <CheckCircle2 className="h-5 w-5 text-[#26b183]" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-[#363636] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.completed")}
        </div>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="relative group/status">
        <Circle className="h-4 w-4 fill-current text-[#D4705D]" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-[#363636] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.inProgress")}
        </div>
      </div>
    );
  }

  if (status === "not_started") {
    return (
      <div className="relative group/status">
        <Minus className="h-5 w-5 text-[#676767]" />
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-[#363636] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100">
          {t("modernCourseView.contents.status.notStarted")}
        </div>
      </div>
    );
  }

  return null;
}
