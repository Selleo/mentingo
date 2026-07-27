import { LESSON_TYPES } from "@repo/shared";
import { HelpCircle, MonitorPlay, Play, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

type LessonTypeIconProps = {
  type: string;
};

export default function LessonTypeIcon({ type }: LessonTypeIconProps) {
  const { t } = useTranslation();

  const iconMap = {
    [LESSON_TYPES.CONTENT]: {
      icon: <MonitorPlay className="size-4 text-primary-700" />,
      label: t("modernCourseView.contents.lessonTypes.content"),
    },
    [LESSON_TYPES.QUIZ]: {
      icon: <HelpCircle className="size-4 text-primary-700" />,
      label: t("modernCourseView.contents.lessonTypes.quiz"),
    },
    [LESSON_TYPES.AI_MENTOR]: {
      icon: <Sparkles className="size-4 text-primary-700" />,
      label: t("modernCourseView.contents.lessonTypes.aiMentor"),
    },
  };

  const { icon, label } = iconMap[type as keyof typeof iconMap] || {
    icon: <Play className="size-4 text-primary-700" />,
    label: t("modernCourseView.contents.lessonTypes.lesson"),
  };

  return (
    <div className="relative group/icon">
      {icon}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/icon:opacity-100">
        {label}
      </div>
    </div>
  );
}
