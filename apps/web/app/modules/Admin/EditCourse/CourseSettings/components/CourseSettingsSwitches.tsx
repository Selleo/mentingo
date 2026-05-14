import { COURSE_FEATURE, COURSE_TYPE, isCourseFeatureEnabledForCourseType } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useUpdateCourseSettings } from "~/api/mutations/useUpdateCourseSettings";
import { useCourseSettings } from "~/api/queries/useCourseSettings";
import { Switch } from "~/components/ui/switch";

import { COURSE_SETTINGS_HANDLES } from "../../../../../../e2e/data/courses/handles";

import type { CourseFeature, CourseType } from "@repo/shared";

type Props = {
  courseId: string;
  courseType?: CourseType;
};

type CourseSettingsSwitch = {
  key: string;
  feature: CourseFeature;
  label: string;
  description: string;
  isEnabled?: boolean;
  onToggle: (nextValue: boolean) => void;
  ariaLabel: string;
};

export const CourseSettingsSwitches = ({ courseId, courseType = COURSE_TYPE.DEFAULT }: Props) => {
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

  const settings: CourseSettingsSwitch[] = [
    {
      key: "lessonSequenceEnabled",
      feature: COURSE_FEATURE.LESSON_SEQUENCE_SETTING,
      label: t("adminCourseView.settings.other.enforceLessonSequence"),
      description: t("adminCourseView.settings.other.requireSequentialLessons"),
      isEnabled: data?.lessonSequenceEnabled,
      onToggle: handleLessonSequenceToggle,
      ariaLabel: t("adminCourseView.settings.other.enforceLessonSequence"),
    },
    {
      key: "quizFeedbackEnabled",
      feature: COURSE_FEATURE.QUIZ_FEEDBACK_SETTING,
      label: t("adminCourseView.settings.other.enableQuizFeedback"),
      description: t("adminCourseView.settings.other.enableQuizFeedbackDescription"),
      isEnabled: data?.quizFeedbackEnabled,
      onToggle: handleQuizFeedbackToggle,
      ariaLabel: t("adminCourseView.settings.other.enableQuizFeedback"),
    },
  ].filter((setting) => isCourseFeatureEnabledForCourseType(courseType, setting.feature));

  if (!settings.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {settings.map((setting) => (
        <div
          key={setting.key}
          className="rounded-lg border border-neutral-300 p-4 gap-3 items-center flex"
        >
          <Switch
            data-testid={
              setting.key === "lessonSequenceEnabled"
                ? COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH
                : COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH
            }
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
