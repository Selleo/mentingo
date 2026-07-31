import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { BrainCircuit, ChevronRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAiMentorPracticeToday } from "~/api/queries/useAiMentorPracticeToday";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

export function WidgetStudentAiMentorPractice() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAiMentorPracticeToday();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE];
  const actionLabel = data
    ? t("dashboardHome.widgets.studentTiles.aiMentorPractice.continueCta")
    : t("dashboardHome.widgets.studentTiles.aiMentorPractice.startCta");

  return (
    <DashboardWidgetCard>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent>
        {isLoading || isError ? (
          <DashboardWidgetQueryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="flex min-h-48 flex-col justify-center gap-4">
            <div
              className={cn("rounded-lg border border-primary-100 bg-primary-50 p-4", {
                "border-error-100 bg-error-50": data?.status === "failed",
                "border-success-100 bg-success-50": data?.status === "ready",
              })}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700",
                    {
                      "bg-error-100 text-error-700": data?.status === "failed",
                      "bg-success-100 text-success-700": data?.status === "ready",
                    },
                  )}
                >
                  {data ? (
                    <BrainCircuit className="size-5" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn("body-sm-md text-primary-800", {
                      "text-error-800": data?.status === "failed",
                      "text-success-800": data?.status === "ready",
                    })}
                  >
                    {data
                      ? t(
                          `dashboardHome.widgets.studentTiles.aiMentorPractice.status.${data.status}`,
                        )
                      : t("dashboardHome.widgets.studentTiles.aiMentorPractice.empty")}
                  </p>
                  {data?.title && (
                    <h3 className="body-md-md mt-2 line-clamp-2 text-neutral-950">{data.title}</h3>
                  )}
                </div>
              </div>
            </div>
            <Button asChild size="sm" className="self-start">
              <Link to={`/ai-mentor/practice/${data?.id ?? "new"}`}>
                {actionLabel}
                <ChevronRight className="ml-1 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </DashboardWidgetContent>
    </DashboardWidgetCard>
  );
}
