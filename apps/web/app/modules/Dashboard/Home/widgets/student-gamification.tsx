import { DASHBOARD_WIDGET_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { useUserGamificationProfile } from "~/api/queries/useUserGamificationProfile";
import { LevelProgress } from "~/modules/Gamification/LevelProgress";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

const VISIBLE_REWARDS = 2;

export function WidgetStudentGamification() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();
  const { data, isLoading, isError, refetch } = useUserGamificationProfile(currentUser?.id);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.GAMIFICATION];
  const rewards = data?.recentRewards.slice(0, VISIBLE_REWARDS) ?? [];

  return (
    <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_GAMIFICATION}>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        dataScope={metadata.dataScope}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className="flex min-h-0 flex-col gap-3 p-4">
        <DashboardWidgetQueryState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
        {data && <LevelProgress profile={data} />}
        {data && rewards.length === 0 && (
          <p className="body-sm text-neutral-600">
            {t("dashboardHome.widgets.studentTiles.gamification.empty")}
          </p>
        )}
        {rewards.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="body-sm-md text-neutral-950">
              {t("dashboardHome.widgets.studentTiles.gamification.recentRewards")}
            </span>
            <ul className="flex flex-col gap-1">
              {rewards.map((reward) => (
                <li key={reward.id} className="flex justify-between gap-2 body-sm">
                  <span className="truncate text-neutral-800">{reward.achievementTitle}</span>
                  <span className="shrink-0 text-success-700">
                    {t("gamification.xpGain", { xp: reward.xpReward })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DashboardWidgetContent>
    </DashboardWidgetCard>
  );
}
