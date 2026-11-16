import { useTranslation } from "react-i18next";

import { LESSON_STATUS_TO_PROGRESS, ProgressBadge } from "~/components/Badges/ProgressBadge";

import type { ProgressStatus } from "../../Lesson/types";

type LessonStatusIconProps = {
  status: ProgressStatus;
};

// Same icon and wording as the lesson sidebar and chapter list; the label is screen-reader text
// from ProgressBadge, so the hover tooltip is only visual.
export default function LessonStatusIcon({ status }: LessonStatusIconProps) {
  const { t } = useTranslation();
  const progress = LESSON_STATUS_TO_PROGRESS[status];

  return (
    <div className="relative group/status">
      <ProgressBadge progress={progress} hideLabel />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/status:opacity-100"
      >
        {t(`progressBadge.${progress}`)}
      </div>
    </div>
  );
}
