import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

import { DASHBOARD_WIDGET_IDS, type DashboardWidgetLayout } from "./dashboard.types";
import DashboardGrid from "./DashboardGrid";
import { EmptyDashboard } from "./EmptyDashboard";

export default function DashboardPage() {
  const widgets: DashboardWidgetLayout[] = [
    {
      widgetId: DASHBOARD_WIDGET_IDS.CONTINUE_LEARNING,
      order: 1,
      enabled: true,
    },
  ];

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-lg">Dashboard</h1>

            <p className="text-neutral-700">Najważniejsze informacje w jednym miejscu</p>
          </div>

          <Button>Dostosuj dashboard</Button>
        </header>

        {widgets.length === 0 ? <EmptyDashboard /> : <DashboardGrid widgets={widgets} />}
      </div>
    </PageWrapper>
  );
}
