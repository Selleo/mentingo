import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateDashboardLayout } from "~/api/mutations/useUpdateDashboardLayout";
import { useDashboardLayout } from "~/api/queries/useDashboardLayout";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

import { isImplementedDashboardWidget } from "./dashboard.types";
import { setDashboardWidgetEnabled } from "./dashboard.utils";
import DashboardGrid from "./DashboardGrid";
import { DashboardWidgetPicker } from "./DashboardWidgetPicker";
import { EmptyDashboard } from "./EmptyDashboard";

import type { DashboardWidgetLayout, DashboardWidgetId } from "./dashboard.types";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: widgets = [], isLoading, isError } = useDashboardLayout();
  const { mutateAsync: updateDashboardLayout, isPending: isSaving } = useUpdateDashboardLayout();
  const [isEditing, setIsEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidgetLayout[]>([]);
  const layoutWidgets = isEditing ? draftWidgets : widgets;
  const visibleWidgets = layoutWidgets.filter(
    (widget) => widget.enabled && isImplementedDashboardWidget(widget.widgetId),
  );

  const handleCancelEditing = () => {
    setDraftWidgets(widgets);
    setIsEditing(false);
  };

  const handleSaveLayout = async () => {
    try {
      await updateDashboardLayout(draftWidgets);
      setIsEditing(false);
    } catch {
      // The mutation hook keeps customization open and displays the translated API error.
    }
  };

  const handleWidgetEnabledChange = (widgetId: DashboardWidgetId, enabled: boolean) => {
    setDraftWidgets((currentWidgets) =>
      setDashboardWidgetEnabled(currentWidgets, widgetId, enabled),
    );
  };

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

          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={isSaving} onClick={handleCancelEditing}>
                {t("common.button.cancel")}
              </Button>

              <Button
                disabled={isSaving}
                onClick={() => {
                  void handleSaveLayout();
                }}
              >
                {t(isSaving ? "common.button.saving" : "common.button.save")}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                setDraftWidgets(widgets);
                setIsEditing(true);
              }}
            >
              {t("dashboardView.customize")}
            </Button>
          )}
        </header>

        {isEditing ? (
          <DashboardWidgetPicker
            widgets={draftWidgets}
            onWidgetEnabledChange={handleWidgetEnabledChange}
          />
        ) : null}

        {visibleWidgets.length ? (
          <DashboardGrid
            widgets={layoutWidgets}
            isEditing={isEditing}
            onReorder={setDraftWidgets}
          />
        ) : (
          <EmptyDashboard />
        )}
      </div>
    </PageWrapper>
  );
}
