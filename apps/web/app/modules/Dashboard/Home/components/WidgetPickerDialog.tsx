import { DASHBOARD_WIDGETS, type DashboardWidgetId } from "@repo/shared";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";

import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardWidgetIcon } from "./WidgetCard";

import type { DashboardLayoutItem } from "../types";

type WidgetPickerDialogProps = {
  open: boolean;
  availableWidgets: DashboardWidgetId[];
  savedWidgets: DashboardLayoutItem[];
  onOpenChange: (open: boolean) => void;
  onWidgetsChange: (widgets: DashboardLayoutItem[]) => void;
  onWidgetsRestoreDefault: () => Promise<void>;
  isRestoringDefault: boolean;
};

export function WidgetPickerDialog({
  open,
  availableWidgets,
  savedWidgets,
  onOpenChange,
  onWidgetsChange,
  onWidgetsRestoreDefault,
  isRestoringDefault,
}: WidgetPickerDialogProps) {
  const { t } = useTranslation();

  const handleVisibilityChange = (id: DashboardWidgetId, isVisible: boolean) => {
    if (!isVisible) {
      onWidgetsChange(
        savedWidgets
          .filter((widget) => widget.id !== id)
          .map((widget, order) => ({ ...widget, order })),
      );
      return;
    }

    const definition = DASHBOARD_WIDGETS[id];
    onWidgetsChange([
      ...savedWidgets,
      {
        id,
        order: savedWidgets.length,
        width: definition.defaultWidth,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="mobileDrawer" className="flex flex-col sm:!max-w-2xl">
        <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold text-neutral-950">
            {t("dashboardHome.edit.widgetLibrary")}
          </DialogTitle>
          <DialogDescription>{t("dashboardHome.edit.widgetLibraryDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto px-6 py-5">
          {availableWidgets.map((widgetId) => {
            const entry = DASHBOARD_WIDGET_REGISTRY[widgetId];
            const definition = DASHBOARD_WIDGETS[widgetId];
            const isVisible = savedWidgets.some((widget) => widget.id === widgetId);
            const Icon = entry.icon;
            const switchId = `dashboard-widget-${widgetId}`;

            return (
              <div
                key={widgetId}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <DashboardWidgetIcon
                    icon={Icon}
                    iconClassName={entry.iconClassName}
                    iconContainerClassName={entry.iconContainerClassName}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={switchId} className="body-sm-md block text-neutral-950">
                        {t(entry.titleKey)}
                      </label>
                      {definition.alwaysVisible && (
                        <Badge className="w-fit px-1.5 py-0.5 text-[11px]" variant="notStarted">
                          {t("dashboardHome.edit.required")}
                        </Badge>
                      )}
                    </div>
                    <p className="body-sm mt-0.5 text-neutral-600">{t(entry.descriptionKey)}</p>
                  </div>
                </div>

                <Switch
                  id={switchId}
                  checked={isVisible || definition.alwaysVisible}
                  disabled={definition.alwaysVisible}
                  onCheckedChange={(checked) => handleVisibilityChange(widgetId, checked)}
                  aria-label={t("dashboardHome.edit.toggle", { title: t(entry.titleKey) })}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="min-h-0 px-6 py-5 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onWidgetsRestoreDefault()}
            disabled={isRestoringDefault}
          >
            {isRestoringDefault ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {t("common.button.loading")}
              </>
            ) : (
              t("dashboardHome.edit.restore")
            )}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("common.button.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
