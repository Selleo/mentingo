import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDashboardDeadlineRisks } from "~/api/queries/useDashboardDeadlineRisks";
import { useDashboardDeadlineRiskSummary } from "~/api/queries/useDashboardDeadlineRiskSummary";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";

const RISK_TYPE = {
  OVERDUE: "overdue",
  DUESOON: "dueSoon",
} as const;
type RiskType = (typeof RISK_TYPE)[keyof typeof RISK_TYPE];

const DETAILS_PAGE_SIZE = 20;

export function WidgetAdminDeadlineRisks() {
  const { t, i18n } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: risks, isLoading, isError, refetch } = useDashboardDeadlineRiskSummary();
  const [selectedRisk, setSelectedRisk] = useState<RiskType>(RISK_TYPE.OVERDUE);
  const [areRiskDetailsOpen, setAreRiskDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.ADMIN_DEADLINE_RISKS];
  const isOverdue = selectedRisk === "overdue";
  const {
    data: riskDetails,
    isLoading: areRiskDetailsLoading,
    isError: areRiskDetailsError,
    refetch: refetchRiskDetails,
  } = useDashboardDeadlineRisks(
    {
      language,
      type: selectedRisk,
      page,
      perPage: DETAILS_PAGE_SIZE,
    },
    areRiskDetailsOpen,
  );
  const visibleCourses = riskDetails?.data ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil(
      (riskDetails?.pagination.totalItems ?? 0) /
        (riskDetails?.pagination.perPage ?? DETAILS_PAGE_SIZE),
    ),
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value));
  const openRiskDetails = (riskType: RiskType) => {
    setSelectedRisk(riskType);
    setPage(1);
    setAreRiskDetailsOpen(true);
  };

  return (
    <>
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS}>
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
          ) : (risks?.overdueCount ?? 0) === 0 && (risks?.dueSoonCount ?? 0) === 0 ? (
            <p className="text-neutral-600">{t("dashboardHome.widgets.deadline_risks.empty")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openRiskDetails(RISK_TYPE.OVERDUE)}
                className="min-h-28 rounded-lg border border-error-100 bg-error-50 p-4 text-left transition-colors hover:border-error-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-300 focus-visible:ring-offset-2"
              >
                <span className="h4 text-error-700">{risks?.overdueCount ?? 0}</span>
                <span className="body-sm-md mt-1 block text-error-800">
                  {t("dashboardHome.widgets.deadline_risks.overdue")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openRiskDetails(RISK_TYPE.DUESOON)}
                className="min-h-28 rounded-lg border border-warning-100 bg-warning-50 p-4 text-left transition-colors hover:border-warning-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-300 focus-visible:ring-offset-2"
              >
                <span className="h4 text-warning-700">{risks?.dueSoonCount ?? 0}</span>
                <span className="body-sm-md mt-1 block text-warning-800">
                  {t("dashboardHome.widgets.deadline_risks.dueSoon")}
                </span>
              </button>
            </div>
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>

      <Dialog open={areRiskDetailsOpen} onOpenChange={setAreRiskDetailsOpen}>
        <DialogContent variant="mobileDrawer" className="flex flex-col sm:!max-w-2xl">
          <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-neutral-950">
              {t(
                isOverdue
                  ? "dashboardHome.widgets.deadline_risks.overdueTitle"
                  : "dashboardHome.widgets.deadline_risks.dueSoonTitle",
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">{t(metadata.descriptionKey)}</DialogDescription>
          </DialogHeader>
          {areRiskDetailsLoading || areRiskDetailsError ? (
            <DashboardWidgetQueryState
              isLoading={areRiskDetailsLoading}
              isError={areRiskDetailsError}
              onRetry={() => void refetchRiskDetails()}
              className="p-5"
            />
          ) : (
            <>
              <Accordion
                type="multiple"
                className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto px-6 py-5"
              >
                {visibleCourses.map((course) => {
                  const relevantDate = course.students.at(0)?.dueDate;

                  return (
                    <AccordionItem
                      key={course.id}
                      value={course.id}
                      className="rounded-lg border px-4"
                    >
                      <AccordionTrigger className="gap-4 py-3 text-left">
                        <div className="min-w-0 flex-1">
                          <span className="line-clamp-1 font-medium text-neutral-950">
                            {course.title}
                          </span>
                          <span className="block text-xs font-normal text-neutral-500">
                            {t("dashboardHome.widgets.deadline_risks.affected", {
                              count: course.students.length,
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 justify-center items-end">
                          <Button asChild variant="ghost" size="xs">
                            <Link to={`/course/${course.id}?tab=Statistics`}>
                              {t("dashboardHome.widgets.deadline_risks.goToCourse")}
                            </Link>
                          </Button>
                          {relevantDate && (
                            <span
                              className={cn(
                                "shrink-0 text-xs font-medium",
                                isOverdue ? "text-error-700" : "text-warning-700",
                              )}
                            >
                              {formatDate(relevantDate)}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="border-t py-2">
                        {course.students.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between gap-4 border-b border-neutral-100 py-2 last:border-0"
                          >
                            <span className="truncate text-sm">{student.name}</span>
                            <span
                              className={cn(
                                "shrink-0 text-xs font-medium",
                                isOverdue ? "text-error-700" : "text-warning-700",
                              )}
                            >
                              {formatDate(student.dueDate)}
                              {" · "}
                              {t(
                                isOverdue
                                  ? "dashboardHome.widgets.deadline_risks.overdue"
                                  : "dashboardHome.widgets.deadline_risks.dueSoon",
                              )}
                            </span>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {t("common.button.previous")}
                  </Button>
                  <span className="details text-neutral-500">
                    {t("dashboardHome.widgets.deadlineRisksPage", { page, totalPages })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    {t("common.button.next")}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
