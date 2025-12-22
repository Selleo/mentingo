import { useTranslation } from "react-i18next";

import { useUpdateCourseSettings } from "~/api/mutations/useUpdateCourseSettings";
import { useCourseSettings } from "~/api/queries/useCourseSettings";
import { Switch } from "~/components/ui/switch";

type Props = {
  courseId: string;
};

export const CourseSettingsSwitches = ({ courseId }: Props) => {
  const { t } = useTranslation();
  const { data, isLoading } = useCourseSettings({ courseId });
  const { mutate: updateCourseSettings, isPending: isUpdatingCourseSettings } =
    useUpdateCourseSettings();

  const handleLessonSequenceToggle = (nextValue: boolean) => {
    if (!courseId) return;
    updateCourseSettings({ courseId, data: { lessonSequenceEnabled: nextValue } });
  };

  const handleQuizFeedbackToggle = (nextValue: boolean) => {
    if (!courseId) return;
    updateCourseSettings({ courseId, data: { quizFeedbackEnabled: nextValue } });
  };

  const isDisabled = isLoading || isUpdatingCourseSettings;

  const settings = [
    {
      key: "lessonSequenceEnabled",
      label: t("adminCourseView.settings.other.enforceLessonSequence"),
      description: t("adminCourseView.settings.other.requireSequentialLessons"),
      isEnabled: data?.lessonSequenceEnabled,
      onToggle: handleLessonSequenceToggle,
      ariaLabel: t("adminCourseView.settings.other.enforceLessonSequence"),
    },
    {
      key: "quizFeedbackEnabled",
      label: t("adminCourseView.settings.other.enableQuizFeedback"),
      description: t("adminCourseView.settings.other.enableQuizFeedbackDescription"),
      isEnabled: data?.quizFeedbackEnabled,
      onToggle: handleQuizFeedbackToggle,
      ariaLabel: t("adminCourseView.settings.other.enableQuizFeedback"),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {settings.map((setting) => (
        <div
          key={setting.key}
          className="rounded-lg border border-neutral-300 p-4 gap-3 items-center flex"
        >
          <Switch
            checked={setting.isEnabled}
            onCheckedChange={setting.onToggle}
            disabled={isDisabled}
            aria-label={setting.ariaLabel}
          />
          <div className="flex flex-col gap-1">
            <p className="text-base text-neutral-950 font-semibold">{setting.label}</p>
            <p className="text-sm text-neutral-800">{setting.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
