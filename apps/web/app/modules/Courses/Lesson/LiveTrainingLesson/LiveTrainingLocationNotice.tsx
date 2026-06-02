import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LIVE_TRAINING_LESSON_HANDLES } from "../../../../../e2e/data/live-training/handles";

type LiveTrainingLocationNoticeProps = {
  location: string;
};

export function LiveTrainingLocationNotice({ location }: LiveTrainingLocationNoticeProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid={LIVE_TRAINING_LESSON_HANDLES.LOCATION_NOTICE}
      className="mt-3 flex min-w-0 items-center gap-2 border-t border-neutral-100 pt-3"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded bg-neutral-50 text-primary-700">
        <MapPin className="size-4" />
      </span>
      <span className="shrink-0 text-sm text-neutral-500">
        {t("studentLessonView.liveTraining.locationNotice")}
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-neutral-950" title={location}>
        {location}
      </span>
    </div>
  );
}
