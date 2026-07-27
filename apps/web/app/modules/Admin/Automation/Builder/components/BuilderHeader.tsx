import { ArrowLeft, Loader2, Play, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useBuilderHeaderActions } from "../hooks/useBuilderHeaderActions";

import { SimulationPanel } from "./SimulationPanel";

import type { FC } from "react";

interface BuilderHeaderProps {
  automationId: string;
}

export const BuilderHeader: FC<BuilderHeaderProps> = ({ automationId }) => {
  const { t } = useTranslation();

  const {
    automationName,
    isActive,
    lastSavedAt,
    toggleDisabled,
    showLeaveDialog,
    showDeleteDialog,
    simulationState,
    isSimulating,
    panelOpen,
    setShowLeaveDialog,
    setShowDeleteDialog,
    handleBack,
    handleSave,
    handleSaveAndLeave,
    handleLeaveWithoutSaving,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleSimulate,
    handleRetrySimulation,
    handleToggleActive,
    closePanel,
    getToggleTooltip,
    formatSavedTime,
    isSavePending,
    isDeletePending,
  } = useBuilderHeaderActions({ automationId });

  return (
    <TooltipProvider>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                aria-label={t("automationBuilder.header.back")}
              >
                <ArrowLeft className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("automationBuilder.header.back")}</TooltipContent>
          </Tooltip>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button onClick={handleBack} className="cursor-pointer">
                    {t("automationBuilder.header.automations")}
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-base font-semibold text-foreground">
                  {automationName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-3">
          {lastSavedAt && (
            <span className="text-xs text-muted-foreground">{formatSavedTime()}</span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSavePending || automationId === "new"}
          >
            <Save className="mr-1.5 size-4" />
            {t("automationBuilder.header.save")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulate}
            disabled={isSimulating || automationId === "new"}
          >
            {isSimulating ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 size-4" />
            )}
            {t("automationBuilder.header.simulate")}
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-medium",
                isActive ? "text-success-600" : "text-amber-600",
              )}
            >
              {isActive
                ? t("automationBuilder.header.active")
                : t("automationBuilder.header.draft")}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch
                    checked={isActive}
                    onCheckedChange={handleToggleActive}
                    disabled={toggleDisabled}
                  />
                </span>
              </TooltipTrigger>
              {getToggleTooltip() && (
                <TooltipContent side="bottom">{getToggleTooltip()}</TooltipContent>
              )}
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteRequest}
                disabled={isDeletePending || automationId === "new"}
              >
                <Trash2 className="mr-1.5 size-4" />
                {t("automationBuilder.header.delete")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("automationBuilder.header.delete")}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <SimulationPanel
        open={panelOpen}
        onClose={closePanel}
        state={simulationState}
        onRetry={handleRetrySimulation}
      />

      {/* Leave confirmation dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("automationBuilder.header.leaveDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationBuilder.header.leaveDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("automationBuilder.header.leaveDialog.cancel")}
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleLeaveWithoutSaving}>
              {t("automationBuilder.header.leaveDialog.leaveWithoutSaving")}
            </Button>
            <AlertDialogAction onClick={handleSaveAndLeave}>
              {t("automationBuilder.header.leaveDialog.saveAndLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("automationBuilder.header.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationBuilder.header.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("automationBuilder.header.deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("automationBuilder.header.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};
