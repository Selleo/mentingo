import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateLessonSequence } from "~/api/mutations/useUpdateLessonSequence";
import { useLessonSequence } from "~/api/queries/useLessonSequence";
import { Switch } from "~/components/ui/switch";

type CourseLessonSequenceSwitchProps = {
  courseId: string;
};

const CourseLessonSequenceSwitch = ({ courseId }: CourseLessonSequenceSwitchProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useLessonSequence({ courseId });
  const { mutate: updateLessonSequence, isPending: isUpdatingLessonSequence } =
    useUpdateLessonSequence();

  const isEnabled = useMemo(
    () => Boolean(data?.data.lessonSequenceEnabled),
    [data?.data.lessonSequenceEnabled],
  );

  const handleToggle = (nextValue: boolean) => {
    if (!courseId) return;
    updateLessonSequence({ courseId, data: { lessonSequenceEnabled: nextValue } });
  };

  return (
    <div className="rounded-lg border border-neutral-300 p-4 gap-3 items-center flex">
      <Switch
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isLoading || isUpdatingLessonSequence}
        aria-label={t("adminCourseView.settings.other.enforceLessonSequence")}
      />
      <div className="flex flex-col gap-1">
        <p className="text-base text-neutral-950 font-semibold">
          {t("adminCourseView.settings.other.enforceLessonSequence")}
        </p>
        <p className="text-sm text-neutral-800">
          {t("adminCourseView.settings.other.requireSequentialLessons")}
        </p>
      </div>
    </div>
  );
};

export default CourseLessonSequenceSwitch;
