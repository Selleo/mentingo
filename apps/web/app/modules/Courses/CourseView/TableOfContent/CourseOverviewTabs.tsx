import { CircleAlert, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { COURSE_DISCUSSION_HANDLES } from "../../../../../e2e/data/courses/handles";
import { COURSE_STATISTICS_HANDLES } from "../../../../../e2e/data/statistics/handles";

import type { ReactNode } from "react";

export const COURSE_OVERVIEW_TABS = {
  TOC: "toc",
  STATISTICS: "statistics",
  CHAT: "chat",
} as const;

export type CourseOverviewTab = (typeof COURSE_OVERVIEW_TABS)[keyof typeof COURSE_OVERVIEW_TABS];

export const CourseOverviewTabButton = ({
  active,
  children,
  onClick,
  testId,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className={cn(
      "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
      active ? "text-primary-700" : "text-neutral-800 hover:text-neutral-950",
    )}
  >
    {children}
    {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />}
  </button>
);

type CourseOverviewTabsProps = {
  activeTab: CourseOverviewTab;
  canEditContent: boolean;
  canShowChat: boolean;
  canShowStatistics: boolean;
  hasMissingTranslations: boolean;
  onEditContent: () => void;
  onTabChange: (tab: CourseOverviewTab) => void;
};

export default function CourseOverviewTabs({
  activeTab,
  canEditContent,
  canShowChat,
  canShowStatistics,
  hasMissingTranslations,
  onEditContent,
  onTabChange,
}: CourseOverviewTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 border-b border-neutral-200 sm:flex-row sm:items-center md:mb-6">
      <div className="flex w-full items-center gap-4 overflow-x-auto sm:w-auto md:gap-6">
        <button
          type="button"
          onClick={() => onTabChange(COURSE_OVERVIEW_TABS.TOC)}
          className={cn(
            "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
            activeTab === COURSE_OVERVIEW_TABS.TOC
              ? "text-primary-700"
              : "text-neutral-800 hover:text-neutral-950",
          )}
        >
          {t("modernCourseView.contents.title")}
          {activeTab === COURSE_OVERVIEW_TABS.TOC && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />
          )}
        </button>
        {canShowStatistics && (
          <button
            type="button"
            data-testid={COURSE_STATISTICS_HANDLES.COURSE_VIEW_STATISTICS_TAB}
            data-state={activeTab === COURSE_OVERVIEW_TABS.STATISTICS ? "active" : "inactive"}
            onClick={() => onTabChange(COURSE_OVERVIEW_TABS.STATISTICS)}
            className={cn(
              "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
              activeTab === COURSE_OVERVIEW_TABS.STATISTICS
                ? "text-primary-700"
                : "text-neutral-800 hover:text-neutral-950",
            )}
          >
            {t("modernCourseView.contents.statistics")}
            {activeTab === COURSE_OVERVIEW_TABS.STATISTICS && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />
            )}
          </button>
        )}
        {canShowChat && (
          <button
            type="button"
            data-testid={COURSE_DISCUSSION_HANDLES.TAB}
            onClick={() => onTabChange(COURSE_OVERVIEW_TABS.CHAT)}
            className={cn(
              "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
              activeTab === COURSE_OVERVIEW_TABS.CHAT
                ? "text-primary-700"
                : "text-neutral-800 hover:text-neutral-950",
            )}
          >
            {t("studentCourseView.tabs.chat")}
            {activeTab === COURSE_OVERVIEW_TABS.CHAT && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />
            )}
          </button>
        )}
      </div>
      {canEditContent && (
        <div className="mb-3 flex items-center gap-2">
          {hasMissingTranslations && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 text-warning-800 hover:text-warning-800 hover:bg-white"
                    aria-label={t("modernCourseView.contents.missingTranslationsTitle")}
                  >
                    <CircleAlert className="size-7" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                  className="w-96 max-w-[calc(100vw-2rem)] p-4"
                >
                  <p className="text-sm font-semibold">
                    {t("modernCourseView.contents.missingTranslationsTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-5">
                    {t("modernCourseView.contents.missingTranslationsDescription")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <Button variant="primary" onClick={onEditContent} className="flex items-center gap-2">
            <Edit2 className="size-4" />
            <span className="text-sm font-semibold">{t("modernCourseView.contents.edit")}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
