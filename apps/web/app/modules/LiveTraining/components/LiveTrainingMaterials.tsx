import { LIVE_TRAINING_STATUSES } from "@repo/shared";
import { FileText, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { LIVE_TRAINING_FILE_TABS } from "~/modules/LiveTraining/liveTraining.types";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingMaterialsProps = {
  liveTraining: LiveTrainingDetails;
};

type MaterialPanelProps = {
  title: string;
  description: string;
  count: number;
  emptyText: string;
  locked?: boolean;
  lockedText?: string;
};

function MaterialPanel({
  title,
  description,
  count,
  emptyText,
  locked,
  lockedText,
}: MaterialPanelProps) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
        </div>
        <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
          {count}
        </span>
      </div>

      <div className="mt-5 rounded-md border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-8 text-center">
        {locked ? (
          <Lock className="mx-auto size-5 text-neutral-400" />
        ) : (
          <FileText className="mx-auto size-5 text-neutral-400" />
        )}
        <p className="mt-2 text-sm text-neutral-500">{locked ? lockedText : emptyText}</p>
      </div>
    </div>
  );
}

export function LiveTrainingMaterials({ liveTraining }: LiveTrainingMaterialsProps) {
  const { t } = useTranslation();
  const isAfterTabEnabled = liveTraining.status === LIVE_TRAINING_STATUSES.ENDED;

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-950">
          {t("liveTrainingView.files.title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{t("liveTrainingView.files.description")}</p>
      </div>

      <Tabs defaultValue={LIVE_TRAINING_FILE_TABS.BEFORE}>
        <div className="border-b border-neutral-200 px-5 py-3">
          <TabsList className="h-auto bg-neutral-100 p-1">
            <TabsTrigger value={LIVE_TRAINING_FILE_TABS.BEFORE}>
              {t("liveTrainingView.files.beforeHeading")}
            </TabsTrigger>
            <TabsTrigger
              value={LIVE_TRAINING_FILE_TABS.AFTER}
              disabled={!isAfterTabEnabled}
              className={cn({
                "text-neutral-400": !isAfterTabEnabled,
              })}
            >
              {t("liveTrainingView.files.afterHeading")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={LIVE_TRAINING_FILE_TABS.BEFORE}>
          <MaterialPanel
            title={t("liveTrainingView.files.beforeHeading")}
            description={t("liveTrainingView.files.beforeDescription")}
            count={liveTraining.materials.before.length}
            emptyText={t("liveTrainingView.files.empty")}
          />
        </TabsContent>

        <TabsContent value={LIVE_TRAINING_FILE_TABS.AFTER}>
          <MaterialPanel
            title={t("liveTrainingView.files.afterHeading")}
            description={t("liveTrainingView.files.afterDescription")}
            count={liveTraining.materials.after.length}
            emptyText={t("liveTrainingView.files.empty")}
            locked={!isAfterTabEnabled}
            lockedText={t("liveTrainingView.files.afterLocked")}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
