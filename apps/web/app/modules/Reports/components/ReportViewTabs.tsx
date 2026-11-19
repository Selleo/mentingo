import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import { REPORT_VIEW_TABS } from "../constants/reports.constants";

import type { ReportView } from "../types/reports.types";

type ReportViewTabsProps = {
  view: ReportView;
  onViewChange: (view: ReportView) => void;
};

export function ReportViewTabs({ view, onViewChange }: ReportViewTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs value={view} onValueChange={(nextView) => onViewChange(nextView as ReportView)}>
      <div className="overflow-x-auto border-b">
        <TabsList
          aria-label={t("reports.views.title")}
          className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0"
        >
          {REPORT_VIEW_TABS.map(({ view: tabView, icon: ViewIcon }) => (
            <TabsTrigger
              key={tabView}
              value={tabView}
              data-testid={REPORTS_HANDLES.viewTab(tabView)}
              className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
            >
              <ViewIcon className="size-4" aria-hidden="true" />
              {t(`reports.views.${tabView}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
