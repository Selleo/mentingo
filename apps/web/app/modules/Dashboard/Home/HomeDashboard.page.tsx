import { DASHBOARD_WIDGET_SIZES, PERMISSIONS, hasPermission } from "@repo/shared";
import { Download, LayoutGrid, Loader2, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { P, match } from "ts-pattern";

import {
  useResetDashboardSettings,
  useUpdateDashboardSettings,
} from "~/api/mutations/useUpdateDashboardSettings";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useDashboardSettings } from "~/api/queries/useDashboardSettings";
import { PageWrapper } from "~/components/PageWrapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import Loader from "~/modules/common/Loader/Loader";
import { useDownloadSummaryReport } from "~/modules/Statistics/Admin/hooks/useDownloadSummaryReport";
import { setPageTitle } from "~/utils/setPageTitle";

import { DashboardError } from "./components/DashboardError";
import { DashboardGrid } from "./components/DashboardGrid";
import { WidgetPickerDialog } from "./components/WidgetPickerDialog";
import { DashboardEditModeProvider } from "./dashboardEditContext";

import type { DashboardLayoutItem } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { DashboardWidgetType } from "@repo/shared";
export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

type DashboardSettingsWidget = {
  type: DashboardWidgetType;
  size: DashboardLayoutItem["size"];
  visible: boolean;
};

const createLayout = (
  widgets: DashboardSettingsWidget[],
  catalog: { type: DashboardWidgetType; allowedSizes: DashboardLayoutItem["allowedSizes"] }[] = [],
): DashboardLayoutItem[] => {
  const catalogByType = new Map(catalog.map((entry) => [entry.type, entry]));

  return widgets.map((widget, order) => ({
    id: widget.type,
    size: widget.size,
    visible: widget.visible,
    allowedSizes: catalogByType.get(widget.type)?.allowedSizes,
    order,
  }));
};

const cloneLayout = (widgets: DashboardLayoutItem[]): DashboardLayoutItem[] =>
  widgets.map((widget) => ({ ...widget }));

const widgetKey = (widget: DashboardLayoutItem) => widget.id;

/**
 * The grid only receives visible widgets. Merge its reordered list back into
 * the full persisted layout without moving hidden widgets to the end. This
 * keeps a user's hidden card size and future restore position stable.
 */
const mergeVisibleLayout = (
  currentLayout: DashboardLayoutItem[],
  nextVisibleLayout: DashboardLayoutItem[],
): DashboardLayoutItem[] => {
  const currentVisibleKeys = currentLayout
    .filter((widget) => widget.visible !== false)
    .map(widgetKey);
  const nextKeys = nextVisibleLayout.map(widgetKey);
  const isVisibleOnlyUpdate =
    nextVisibleLayout.every((widget) => widget.visible !== false) &&
    currentVisibleKeys.length === nextKeys.length &&
    currentVisibleKeys.every((key) => nextKeys.includes(key));

  if (!isVisibleOnlyUpdate) return nextVisibleLayout.map((widget) => ({ ...widget }));

  let nextVisibleIndex = 0;
  return currentLayout.map((widget) => {
    if (widget.visible === false) return { ...widget };
    const replacement = nextVisibleLayout[nextVisibleIndex];
    nextVisibleIndex += 1;
    return replacement ? { ...replacement } : { ...widget };
  });
};

export default function HomeDashboardPage() {
  const { t } = useTranslation();
  const [savedWidgets, setSavedWidgets] = useState<DashboardLayoutItem[]>([]);
  const [draftWidgets, setDraftWidgets] = useState<DashboardLayoutItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string>();

  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const userId = currentUser?.id;
  const {
    data: dashboardSettings,
    isLoading,
    isError,
    refetch: refetchDashboardSettings,
  } = useDashboardSettings(userId);
  const { mutate: updateDashboardSettings } = useUpdateDashboardSettings();
  const { mutate: resetDashboardSettings, isPending: isRestoringDefault } =
    useResetDashboardSettings();
  const { downloadReport, isDownloading } = useDownloadSummaryReport();

  const canDownloadReport = hasPermission(currentUser?.permissions ?? [], PERMISSIONS.REPORT_READ);

  const visibleLayout = (isEditing ? draftWidgets : savedWidgets).filter(
    (widget) => widget.visible !== false,
  );
  useEffect(() => {
    if (!dashboardSettings || !userId) return;
    const userLayout = createLayout(dashboardSettings.layout.widgets, dashboardSettings.catalog);
    setSavedWidgets(userLayout);
    setDraftWidgets(cloneLayout(userLayout));
    setHydratedUserId(userId);
  }, [dashboardSettings, userId]);

  const handleStartEditing = () => setIsEditing(true);

  const persistLayout = (nextWidgets: DashboardLayoutItem[]) => {
    const normalizedWidgets = mergeVisibleLayout(draftWidgets, nextWidgets).map(
      (widget, order) => ({ ...widget, order }),
    );
    setDraftWidgets(normalizedWidgets);
    setSavedWidgets(normalizedWidgets);
    updateDashboardSettings({
      expectedRevision: dashboardSettings?.layout.revision ?? 0,
      widgets: normalizedWidgets.map((widget) => ({
        type: widget.id,
        size: widget.size ?? DASHBOARD_WIDGET_SIZES.ONE_BY_ONE,
        visible: widget.visible ?? true,
      })),
    });
  };

  const handleRestoreDefault = async () => {
    setIsRestoreConfirmOpen(true);
  };

  const confirmRestoreDefault = () => {
    setIsRestoreConfirmOpen(false);
    resetDashboardSettings(dashboardSettings?.layout.revision ?? 0, {
      onSuccess: (response) => {
        const layout = createLayout(response.layout.widgets, response.catalog);
        setSavedWidgets(layout);
        setDraftWidgets(cloneLayout(layout));
      },
    });
  };

  const isLayoutHydrated = Boolean(dashboardSettings && userId && hydratedUserId === userId);
  const isDashboardLoading = isCurrentUserLoading || isLoading || (!isError && !isLayoutHydrated);

  return (
    <PageWrapper className="min-w-0">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="h4">{t("dashboardHome.title")}</h1>

          {!isError && (
            <div className="flex flex-wrap items-center gap-2">
              {canDownloadReport && (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="dashboard-report-download"
                  onClick={() => void downloadReport()}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {t(
                    isDownloading
                      ? "adminStatisticsView.other.downloadingReport"
                      : "adminStatisticsView.other.downloadReport",
                  )}
                </Button>
              )}
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsWidgetPickerOpen(true)}
                  >
                    <LayoutGrid className="mr-2 size-4" aria-hidden="true" />
                    {t("dashboardHome.edit.widgetsButton")}
                  </Button>
                  <Button type="button" onClick={() => setIsEditing(false)}>
                    {t("common.button.close")}
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={handleStartEditing}>
                  <Settings2 className="mr-2 size-4" aria-hidden="true" />
                  {t("dashboardHome.customize")}
                </Button>
              )}
            </div>
          )}
        </header>

        <div>
          {match([isDashboardLoading, isError])
            .with([true, P._], () => (
              <div className="flex min-h-80 items-center justify-center">
                <Loader />
              </div>
            ))
            .with([false, true], () => (
              <DashboardError
                onRetry={() => {
                  void refetchDashboardSettings();
                }}
              />
            ))
            .otherwise(() => (
              <DashboardEditModeProvider isEditing={isEditing}>
                <DashboardGrid
                  widgets={visibleLayout}
                  isEditing={isEditing}
                  onWidgetsChange={persistLayout}
                />
              </DashboardEditModeProvider>
            ))}
        </div>
      </div>

      <WidgetPickerDialog
        open={isWidgetPickerOpen}
        availableWidgets={dashboardSettings?.catalog ?? []}
        savedWidgets={draftWidgets}
        onOpenChange={setIsWidgetPickerOpen}
        onWidgetsChange={persistLayout}
        onWidgetsRestoreDefault={handleRestoreDefault}
        isRestoringDefault={isRestoringDefault}
      />
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboardHome.edit.restore")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboardHome.edit.restoreConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.button.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreDefault}>
              {t("dashboardHome.edit.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
