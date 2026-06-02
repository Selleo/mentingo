import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { Info, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { LiveTrainingPeopleSection } from "~/modules/LiveTraining/components/LiveTrainingPeopleSection";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingOverviewProps = {
  liveTraining: LiveTrainingDetails;
  canEditPeople: boolean;
  className?: string;
};

export function LiveTrainingOverview({
  liveTraining,
  canEditPeople,
  className,
}: LiveTrainingOverviewProps) {
  const { t } = useTranslation();
  const isOffline = liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;

  return (
    <div className={cn("grid items-start gap-4", className)}>
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-950">
            {t("liveTrainingView.sidebar.details")}
          </h2>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.status")}</dt>
            <dd className="text-right text-neutral-900">
              {t(`liveTrainingView.status.${liveTraining.status}`)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.maxParticipants")}</dt>
            <dd className="text-right text-neutral-900">{liveTraining.maxParticipants}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.visibility")}</dt>
            <dd className="text-right text-neutral-900">
              {t(`liveTrainingView.visibility.${liveTraining.visibilityScope}`)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.courses")}</dt>
            <dd className="text-right text-neutral-900">{liveTraining.linkedCourses.length}</dd>
          </div>
          {isOffline && liveTraining.location && (
            <div className="flex justify-between gap-4">
              <dt className="inline-flex items-center gap-1.5 text-neutral-500">
                <MapPin className="size-3.5" />
                {t("liveTrainingView.sidebar.location")}
              </dt>
              <dd className="text-right text-neutral-900">{liveTraining.location}</dd>
            </div>
          )}
        </dl>
      </section>

      <LiveTrainingPeopleSection liveTraining={liveTraining} canEditPeople={canEditPeople} />
    </div>
  );
}
