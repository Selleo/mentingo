import { Link } from "@remix-run/react";
import { AI_MENTOR_PRACTICE_STATUSES, DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useAiMentorPracticeToday } from "~/api/queries/useAiMentorPracticeToday";
import { Button } from "~/components/ui/button";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../../e2e/data/ai-mentor-practice/handles";

export function WidgetStudentAiMentorPractice() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAiMentorPracticeToday();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE];
  const hasEvaluation = Boolean(data?.evaluation);
  let actionLabel = t("dashboardHome.widgets.studentTiles.aiMentorPractice.startCta");
  if (data) actionLabel = t("dashboardHome.widgets.studentTiles.aiMentorPractice.continueCta");
  if (hasEvaluation)
    actionLabel = t("dashboardHome.widgets.studentTiles.aiMentorPractice.feedbackCta");

  return (
    <div data-testid={AI_MENTOR_PRACTICE_HANDLES.WIDGET}>
      <DashboardWidgetCard>
        <DashboardWidgetHeader
          title={t(metadata.titleKey)}
          icon={metadata.icon}
          showIcon={false}
          iconClassName={metadata.iconClassName}
          iconContainerClassName={metadata.iconContainerClassName}
        />
        <DashboardWidgetContent className="flex flex-col">
          {isLoading || isError ? (
            <DashboardWidgetQueryState
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
            />
          ) : (
            <div className="flex min-h-44 flex-1 flex-col justify-between gap-6" aria-live="polite">
              <div>
                <p className="details-md mb-3 text-primary-700">
                  {hasEvaluation
                    ? t("dashboardHome.widgets.studentTiles.aiMentorPractice.completedEyebrow")
                    : t("dashboardHome.widgets.studentTiles.aiMentorPractice.todayEyebrow")}
                </p>
                <h3 className="body-lg-md line-clamp-3 text-balance text-neutral-950">
                  {data?.title ??
                    t("dashboardHome.widgets.studentTiles.aiMentorPractice.emptyPrompt")}
                </h3>
                {data && data.status !== AI_MENTOR_PRACTICE_STATUSES.READY && (
                  <p className="body-sm mt-3 text-neutral-500">
                    {t(`dashboardHome.widgets.studentTiles.aiMentorPractice.status.${data.status}`)}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-4">
                <p className="details text-neutral-500">
                  {data
                    ? t("dashboardHome.widgets.studentTiles.aiMentorPractice.returnHint")
                    : t("dashboardHome.widgets.studentTiles.aiMentorPractice.privateHint")}
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link to={`/ai-mentor/practice/${data?.id ?? "new"}`}>{actionLabel}</Link>
                </Button>
              </div>
            </div>
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>
    </div>
  );
}
