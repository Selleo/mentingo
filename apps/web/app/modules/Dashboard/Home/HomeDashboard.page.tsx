import { LayoutGrid, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { P, match } from "ts-pattern";

import {
  useResetDashboardSettings,
  useUpdateDashboardSettings,
} from "~/api/mutations/useUpdateDashboardSettings";
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
import { useToast } from "~/components/ui/use-toast";
import Loader from "~/modules/common/Loader/Loader";
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
    id: widget.type as DashboardLayoutItem["id"],
    type: widget.type,
    size: widget.size,
    visible: widget.visible,
    allowedSizes: catalogByType.get(widget.type)?.allowedSizes,
    order,
  }));
};

const cloneLayout = (widgets: DashboardLayoutItem[]): DashboardLayoutItem[] =>
  widgets.map((widget) => ({ ...widget }));

const widgetKey = (widget: DashboardLayoutItem) => widget.type ?? widget.id;

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
  const { toast } = useToast();
  const [savedWidgets, setSavedWidgets] = useState<DashboardLayoutItem[]>([]);
  const [draftWidgets, setDraftWidgets] = useState<DashboardLayoutItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const {
    data: dashboardSettings,
    isLoading,
    isError,
    refetch: refetchDashboardSettings,
  } = useDashboardSettings();
  const { mutateAsync: updateDashboardSettings } = useUpdateDashboardSettings();
  const { mutateAsync: resetDashboardSettings, isPending: isRestoringDefault } =
    useResetDashboardSettings();
  const layoutQueue = useRef(Promise.resolve());
  const revisionRef = useRef(0);
  const draftWidgetsRef = useRef<DashboardLayoutItem[]>([]);
  const lastConfirmedLayout = useRef<DashboardLayoutItem[]>([]);

  const visibleLayout = (isEditing ? draftWidgets : savedWidgets).filter(
    (widget) => widget.visible !== false,
  );
  useEffect(() => {
    if (!dashboardSettings || isEditing) return;
    revisionRef.current = dashboardSettings.layout.revision;
    const userLayout = createLayout(dashboardSettings.layout.widgets, dashboardSettings.catalog);
    draftWidgetsRef.current = cloneLayout(userLayout);
    setSavedWidgets(userLayout);
    setDraftWidgets(cloneLayout(userLayout));
    lastConfirmedLayout.current = userLayout;
  }, [dashboardSettings, isEditing]);

  const handleStartEditing = () => setIsEditing(true);

  const persistLayout = useCallback(
    (nextWidgets: DashboardLayoutItem[]) => {
      const mergedWidgets = mergeVisibleLayout(draftWidgetsRef.current, nextWidgets);
      const normalizedWidgets = mergedWidgets.map((widget, order) => ({
        ...widget,
        order,
      }));
      draftWidgetsRef.current = normalizedWidgets;
      setDraftWidgets(normalizedWidgets);
      setSavedWidgets(normalizedWidgets);
      layoutQueue.current = layoutQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await updateDashboardSettings({
              expectedRevision: revisionRef.current,
              widgets: normalizedWidgets.map((widget) => ({
                type: (widget.type ?? widget.id) as DashboardWidgetType,
                size: widget.size ?? "1x1",
                visible: widget.visible ?? true,
              })),
            });
            revisionRef.current = response.layout.revision;
            const confirmedLayout = createLayout(response.layout.widgets, response.catalog);
            lastConfirmedLayout.current = confirmedLayout;
            draftWidgetsRef.current = cloneLayout(confirmedLayout);
            setSavedWidgets(confirmedLayout);
            setDraftWidgets(cloneLayout(confirmedLayout));
          } catch (error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 409) {
              const refreshed = await refetchDashboardSettings();
              const nextRevision = refreshed.data?.layout.revision;
              if (nextRevision !== undefined) {
                try {
                  const response = await updateDashboardSettings({
                    expectedRevision: nextRevision,
                    widgets: normalizedWidgets.map((widget) => ({
                      type: (widget.type ?? widget.id) as DashboardWidgetType,
                      size: widget.size ?? "1x1",
                      visible: widget.visible ?? true,
                    })),
                  });
                  revisionRef.current = response.layout.revision;
                  const confirmedLayout = createLayout(response.layout.widgets, response.catalog);
                  lastConfirmedLayout.current = confirmedLayout;
                  draftWidgetsRef.current = cloneLayout(confirmedLayout);
                  setSavedWidgets(confirmedLayout);
                  setDraftWidgets(cloneLayout(confirmedLayout));
                  return;
                } catch {
                  // Fall through to the confirmed server layout below.
                }
              }
            }
            const confirmed = lastConfirmedLayout.current;
            draftWidgetsRef.current = cloneLayout(confirmed);
            setSavedWidgets(confirmed);
            setDraftWidgets(cloneLayout(confirmed));
          }
        });
    },
    [refetchDashboardSettings, updateDashboardSettings],
  );

  const handleRestoreDefault = async () => {
    setIsRestoreConfirmOpen(true);
  };

  const confirmRestoreDefault = async () => {
    setIsRestoreConfirmOpen(false);
    try {
      const response = await resetDashboardSettings(revisionRef.current);
      revisionRef.current = response.layout.revision;
      const layout = createLayout(response.layout.widgets, response.catalog);
      draftWidgetsRef.current = cloneLayout(layout);
      setSavedWidgets(layout);
      setDraftWidgets(layout);
      lastConfirmedLayout.current = layout;
    } catch {
      toast({
        variant: "destructive",
        description: t("common.toast.somethingWentWrong"),
      });
    }
  };

  return (
    <PageWrapper className="min-w-0">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="h4">{t("dashboardHome.title")}</h1>

          {!isError &&
            (isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
            ) : (
              <Button type="button" onClick={handleStartEditing}>
                <Settings2 className="mr-2 size-4" aria-hidden="true" />
                {t("dashboardHome.customize")}
              </Button>
            ))}
        </header>

        <div>
          {match([isLoading, isError])
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
            <AlertDialogAction onClick={() => void confirmRestoreDefault()}>
              {t("dashboardHome.edit.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
