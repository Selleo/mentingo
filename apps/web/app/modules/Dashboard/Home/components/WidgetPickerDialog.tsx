import {
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_TYPES,
  type DashboardWidgetType,
} from "@repo/shared";
import { Loader2, UserRound, UsersRound } from "lucide-react";
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
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardWidgetIcon } from "./WidgetCard";

import type { DashboardLayoutItem } from "../types";
import type { DashboardCatalogEntry } from "~/api/queries/useDashboardSettings";

type WidgetPickerDialogProps = {
  open: boolean;
  availableWidgets: DashboardCatalogEntry[];
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

  const handleVisibilityChange = (id: DashboardWidgetType, isVisible: boolean) => {
    const definition = availableWidgets.find((widget) => widget.type === id);
    const isAlwaysVisible = definition?.alwaysVisible ?? DASHBOARD_WIDGET_CATALOG[id].alwaysVisible;
    if (!definition || isAlwaysVisible) return;

    if (!isVisible) {
      onWidgetsChange(
        savedWidgets
          .map((widget) => (widget.id === id ? { ...widget, visible: false } : widget))
          .map((widget, order) => ({ ...widget, order })),
      );
      return;
    }
    const existingWidget = savedWidgets.find((widget) => widget.id === id);
    if (existingWidget) {
      onWidgetsChange(
        savedWidgets.map((widget) => (widget.id === id ? { ...widget, visible: true } : widget)),
      );
      return;
    }

    onWidgetsChange([
      ...savedWidgets,
      {
        id,
        order: savedWidgets.length,
        size: definition.defaultSize,
        allowedSizes: definition.allowedSizes,
        visible: true,
      },
    ]);
  };

  const isRequiredWidget = (widget: DashboardCatalogEntry) =>
    widget.alwaysVisible ?? DASHBOARD_WIDGET_CATALOG[widget.type].alwaysVisible;

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
          {[...availableWidgets]
            .sort((left, right) => Number(isRequiredWidget(right)) - Number(isRequiredWidget(left)))
            .map((definition) => {
              const widgetId = definition.type;
              const entry = DASHBOARD_WIDGET_REGISTRY[widgetId];
              if (!entry) return null;
              const isAlwaysVisible = isRequiredWidget(definition);
              const isVisible = savedWidgets.some(
                (widget) => widget.id === widgetId && widget.visible !== false,
              );
              const Icon = entry.icon;
              const ScopeIcon = entry.dataScope === "personal" ? UserRound : UsersRound;
              const scopeLabel = t(`dashboardHome.widgets.dataScope.${entry.dataScope}`);
              const scopeTooltip = t(`dashboardHome.widgets.dataScope.${entry.dataScope}Tooltip`);
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
                        {widgetId === DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="uppercase">
                                  Beta
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {t("studentLessonView.tooltip.beta")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={scopeLabel}
                                title={scopeLabel}
                                className="inline-flex size-5 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1"
                              >
                                <ScopeIcon className="size-4" aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              align="start"
                              className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                            >
                              {scopeTooltip}
                              <TooltipArrow className="fill-black" />
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {isAlwaysVisible && (
                          <Badge className="px-1.5 py-0.5 text-[11px]" variant="notStarted">
                            {t("dashboardHome.edit.required")}
                          </Badge>
                        )}
                      </div>
                      <p className="body-sm mt-0.5 text-neutral-600">{t(entry.descriptionKey)}</p>
                    </div>
                  </div>

                  <Switch
                    id={switchId}
                    checked={isVisible || isAlwaysVisible}
                    disabled={isAlwaysVisible}
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
