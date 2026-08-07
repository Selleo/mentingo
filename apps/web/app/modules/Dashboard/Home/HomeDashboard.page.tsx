import { LayoutGrid, Loader2, Save, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { P, match } from "ts-pattern";

import { useUpdateDashboardWidgets } from "~/api/mutations/useUpdateDashboardLayout";
import { useDashboardAvailableWidgets } from "~/api/queries/useDashboardAvailableWidgets";
import { useDashboardDefaultWidgets } from "~/api/queries/useDashboardDefaultWidgets";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/use-toast";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import { DashboardError } from "./components/DashboardError";
import { DashboardGrid } from "./components/DashboardGrid";
import { WidgetPickerDialog } from "./components/WidgetPickerDialog";

import type { DashboardLayoutItem } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { GetDefaultDashboardWidgetsResponse } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

type DashboardWidgetApiItem = GetDefaultDashboardWidgetsResponse["data"][number];

const createLayout = (widgets: DashboardWidgetApiItem[]): DashboardLayoutItem[] =>
  widgets.map((widget) => ({ ...widget }));

const cloneLayout = (widgets: DashboardLayoutItem[]): DashboardLayoutItem[] =>
  widgets.map((widget) => ({ ...widget }));

export default function HomeDashboardPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [savedWidgets, setSavedWidgets] = useState<DashboardLayoutItem[]>([]);
  const [draftWidgets, setDraftWidgets] = useState<DashboardLayoutItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = useState(false);

  const {
    data: availableWidgets = [],
    isLoading: isAvailableWidgetsLoading,
    isError: isAvailableWidgetsError,
    refetch: refetchAvailableWidgets,
  } = useDashboardAvailableWidgets();
  const {
    data: userSettings,
    isLoading: isUserSettingsLoading,
    isError: isUserSettingsError,
    refetch: refetchUserSettings,
  } = useUserSettings();
  const { refetch: fetchDefaultDashboardWidgets, isFetching: isDefaultDashboardWidgetsFetching } =
    useDashboardDefaultWidgets(false);
  const { mutateAsync: updateDashboardWidgets, isPending: isUpdateDashboardWidgets } =
    useUpdateDashboardWidgets();

  const visibleLayout = isEditing ? draftWidgets : savedWidgets;
  const isError = isUserSettingsError || isAvailableWidgetsError;
  const isLoading = isUserSettingsLoading || isAvailableWidgetsLoading;

  useEffect(() => {
    if (!userSettings || isEditing) return;

    const userLayout = createLayout(userSettings.dashboard.widgets);
    setSavedWidgets(userLayout);
    setDraftWidgets(cloneLayout(userLayout));
  }, [isEditing, userSettings]);

  const handleStartEditing = () => {
    setDraftWidgets(cloneLayout(savedWidgets));
    setIsEditing(true);
  };

  const handleRestoreDefault = async () => {
    const { data: defaultDashboardWidgets, isError: isDefaultDashboardWidgetsError } =
      await fetchDefaultDashboardWidgets();

    if (!defaultDashboardWidgets || isDefaultDashboardWidgetsError) {
      toast({
        variant: "destructive",
        description: t("common.toast.somethingWentWrong"),
      });
      return;
    }

    setDraftWidgets(createLayout(defaultDashboardWidgets));
  };

  const handleSave = async () => {
    await updateDashboardWidgets({
      dashboard: {
        widgets: draftWidgets.map(({ id, order, width }) => ({
          id,
          order,
          width,
        })),
      },
    });

    setSavedWidgets(cloneLayout(draftWidgets));
    setIsWidgetPickerOpen(false);
    setIsEditing(false);
  };

  const handleDiscard = () => {
    setIsWidgetPickerOpen(false);
    setIsEditing(false);
  };

  return (
    <PageWrapper className="min-w-0">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="h4">{t("dashboardHome.title")}</h1>

          {!isError &&
            (isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="rounded-lg border border-primary-100 bg-white px-4 py-3 text-sm leading-5">
                  {t("dashboardHome.edit.instructions")}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsWidgetPickerOpen(true)}
                  >
                    <LayoutGrid className="mr-2 size-4" aria-hidden="true" />
                    {t("dashboardHome.edit.widgetsButton")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscard}
                    disabled={isUpdateDashboardWidgets}
                  >
                    <X className="mr-2 size-4" aria-hidden="true" />
                    {t("common.button.cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isUpdateDashboardWidgets}
                  >
                    {isUpdateDashboardWidgets ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                        {t("common.button.saving")}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 size-4" aria-hidden="true" />
                        {t("common.button.save")}
                      </>
                    )}
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
                  void refetchUserSettings();
                  void refetchAvailableWidgets();
                }}
              />
            ))
            .otherwise(() => (
              <DashboardGrid
                widgets={visibleLayout}
                isEditing={isEditing}
                onWidgetsChange={setDraftWidgets}
              />
            ))}
        </div>
      </div>

      <WidgetPickerDialog
        open={isWidgetPickerOpen}
        availableWidgets={availableWidgets}
        savedWidgets={draftWidgets}
        onOpenChange={setIsWidgetPickerOpen}
        onWidgetsChange={setDraftWidgets}
        onWidgetsRestoreDefault={handleRestoreDefault}
        isRestoringDefault={isDefaultDashboardWidgetsFetching}
      />
    </PageWrapper>
  );
}
