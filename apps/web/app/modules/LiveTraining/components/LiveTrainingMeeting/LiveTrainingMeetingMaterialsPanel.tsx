import { LIVE_TRAINING_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useOpenLiveTrainingResource } from "~/api/mutations/live-training/useOpenLiveTrainingResource";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { MeetingMaterialList } from "./MeetingMaterialList";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingMeetingMaterialsPanelProps = {
  liveTraining: LiveTrainingDetails;
  canViewAllMaterials: boolean;
};

type LiveTrainingMeetingMaterial = LiveTrainingDetails["materials"]["before"][number];

export function LiveTrainingMeetingMaterialsPanel({
  liveTraining,
  canViewAllMaterials,
}: LiveTrainingMeetingMaterialsPanelProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { mutate: openResource } = useOpenLiveTrainingResource();
  const shouldShowAfterLockedMessage =
    !canViewAllMaterials &&
    liveTraining.status !== LIVE_TRAINING_STATUSES.ENDED &&
    liveTraining.materials.after.length === 0;
  const afterEmptyMessage = shouldShowAfterLockedMessage
    ? t("liveTrainingView.files.afterLocked")
    : t("liveTrainingView.meeting.noMaterials");

  const handleOpen = (material: LiveTrainingMeetingMaterial) => {
    openResource({
      liveTrainingId: liveTraining.id,
      resourceId: material.resourceId,
      language,
      filename: material.title,
    });
  };

  return (
    <div className="grid content-start gap-4">
      <MeetingMaterialList
        title={t("liveTrainingView.meeting.beforeMaterials")}
        materials={liveTraining.materials.before}
        emptyMessage={t("liveTrainingView.meeting.noMaterials")}
        onOpen={handleOpen}
      />
      <MeetingMaterialList
        title={t("liveTrainingView.meeting.afterMaterials")}
        materials={liveTraining.materials.after}
        emptyMessage={afterEmptyMessage}
        onOpen={handleOpen}
      />
    </div>
  );
}
