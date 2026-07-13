import { useDashboardLayout } from "~/api/queries/useDashboardLayout";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

import DashboardGrid from "./DashboardGrid";
import { EmptyDashboard } from "./EmptyDashboard";

export default function DashboardPage() {
  const { data: widgets = [], isLoading, isError } = useDashboardLayout();
  console.log(widgets);
  const visibleWidgets = widgets.filter((widget) => widget.enabled);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper>
        <p className="text-destructive">Nie udało się pobrać dashboardu.</p>
      </PageWrapper>
    );
  }

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

        {visibleWidgets.length ? <DashboardGrid widgets={visibleWidgets} /> : <EmptyDashboard />}
      </div>
    </PageWrapper>
  );
}
