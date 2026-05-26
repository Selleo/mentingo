import { LIVE_TRAINING_STATUSES } from "@repo/shared";
import { Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useOpenLiveTrainingResource } from "~/api/mutations/live-training/useOpenLiveTrainingResource";
import { Button } from "~/components/ui/button";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getReadableFileTypeLabel } from "~/utils/fileDisplay";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingMeetingMaterialsPanelProps = {
  liveTraining: LiveTrainingDetails;
  canViewAllMaterials: boolean;
};

type LiveTrainingMeetingMaterial = LiveTrainingDetails["materials"]["before"][number];

type MeetingMaterialListProps = {
  title: string;
  materials: LiveTrainingMeetingMaterial[];
  emptyMessage: string;
  onOpen: (material: LiveTrainingMeetingMaterial) => void;
};

function MeetingMaterialList({ title, materials, emptyMessage, onOpen }: MeetingMaterialListProps) {
  const { t } = useTranslation();

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</h3>
        <span className="text-xs text-neutral-400">{materials.length}</span>
      </div>

      {materials.length === 0 ? (
        <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-2">
          {materials.map((material) => (
            <div
              key={material.resourceId}
              className="flex min-w-0 items-center gap-2 rounded border border-neutral-200 bg-white p-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-600">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-950" title={material.title}>
                  {material.title}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {getReadableFileTypeLabel(material.contentType)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded text-neutral-500 hover:bg-primary-50 hover:text-primary-700"
                aria-label={t("liveTrainingView.files.download")}
                onClick={() => onOpen(material)}
              >
                <Download className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
