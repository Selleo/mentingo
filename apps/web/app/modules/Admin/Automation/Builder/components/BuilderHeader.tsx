import { useNavigate } from "@remix-run/react";
import { ArrowLeft, Loader2, Play, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteAutomation } from "~/api/mutations/admin/useDeleteAutomation";
import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";
import { nodesToSteps } from "~/api/queries/admin/automation.utils";
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

import { useBuilderStore } from "../automationBuilderStore";
import { useSimulation } from "../hooks/useSimulation";
import { computeTreePositions } from "../utils/computeTreePositions";

import { SimulationPanel } from "./SimulationPanel";

import type { BuilderNode } from "../automationBuilder.types";
import type { FC } from "react";
import type { AutomationNode, AutomationStatus } from "~/api/queries/admin/automation.types";

interface BuilderHeaderProps {
  automationId: string;
}

export const BuilderHeader: FC<BuilderHeaderProps> = ({ automationId }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const automationName = useBuilderStore((s) => s.automationName);
  const isActive = useBuilderStore((s) => s.isActive);
  const simulationPassed = useBuilderStore((s) => s.simulationPassed);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const nodes = useBuilderStore((s) => s.nodes);
  const setActive = useBuilderStore((s) => s.setActive);
  const setSimulationPassed = useBuilderStore((s) => s.setSimulationPassed);
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
  const markSaved = useBuilderStore((s) => s.markSaved);

  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const { simulationState, isSimulating, panelOpen, runSimulation, closePanel, retry } =
    useSimulation();

  const handleBack = () => {
    navigate("/admin/automation");
  };

  const handleSave = () => {
    if (automationId === "new") return;

    const lang = i18n.language || "pl";
    const status: AutomationStatus = isActive ? "enabled" : "draft";

    // Compute tree-based positions before saving
    const positionedNodes = computeTreePositions(nodes);

    // Convert builder nodes to backend step format
    const automationNodes: AutomationNode[] = positionedNodes.map((n: BuilderNode) => ({
      id: n.id,
      kind: n.kind,
      type: n.type,
      label: n.label,
      parentId: n.parentId,
      children: n.children,
      config: n.config,
      position: n.position,
    }));

    const steps = nodesToSteps(automationNodes, automationId);

    updateAutomation.mutate(
      {
        automationId,
        body: {
          name: { [lang]: automationName },
          status,
        },
        steps,
      },
      {
        onSuccess: () => {
          markSaved();
        },
      },
    );
  };

  const handleDelete = () => {
    if (automationId === "new") return;
    deleteAutomation.mutate(automationId, {
      onSuccess: () => {
        navigate("/admin/automation");
      },
    });
  };

  const handleSimulate = () => {
    if (automationId === "new") return;
    runSimulation(nodes);
  };

  // Simulation must pass before activating (draft → active).
  // Deactivating (active → draft) is always allowed.
  const simulationJustPassed =
    simulationState.type === "success" && simulationState.result.overallStatus === "success";

  const canActivate = simulationPassed || simulationJustPassed;

  // Persist per-node simulation status into each node's typeContext when simulation completes
  useEffect(() => {
    if (simulationState.type !== "success") return;
    if (automationId === "new") return;

    const { result } = simulationState;

    // Update each real node's config with its simulation status
    for (const nodeResult of result.nodeResults) {
      // Skip virtual nodes (e.g. "missing-trigger", "missing-action")
      const existingNode = nodes.find((n) => n.id === nodeResult.nodeId);
      if (!existingNode) continue;

      updateNodeConfig(nodeResult.nodeId, {
        simulationStatus: nodeResult.status,
      });
    }

    // Mark overall simulation passed on the trigger
    const passed = result.overallStatus === "success";
    setSimulationPassed(passed);

    const triggerNode = nodes.find((n) => n.kind === "trigger");
    if (triggerNode) {
      updateNodeConfig(triggerNode.id, { simulationPassed: passed });
    }

    // Save steps with updated configs
    // Use setTimeout to let store updates settle
    setTimeout(() => {
      const currentNodes = useBuilderStore.getState().nodes;
      const positionedNodes = computeTreePositions(currentNodes);
      const automationNodes: AutomationNode[] = positionedNodes.map((n: BuilderNode) => ({
        id: n.id,
        kind: n.kind,
        type: n.type,
        label: n.label,
        parentId: n.parentId,
        children: n.children,
        config: n.config,
        position: n.position,
      }));
      const steps = nodesToSteps(automationNodes, automationId);
      updateAutomation.mutate({ automationId, body: {}, steps });
    }, 0);
  }, [simulationState]);

  const handleToggleActive = (active: boolean) => {
    // Block activation when simulation hasn't passed
    if (active && !canActivate) return;

    setActive(active);

    // Persist status change immediately if saved automation
    if (automationId !== "new") {
      const status: AutomationStatus = active ? "enabled" : "draft";
      updateAutomation.mutate({
        automationId,
        body: { status },
      });
    }
  };

  const formatSavedTime = () => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t("automationBuilder.header.savedJustNow");
    return t("automationBuilder.header.savedMinutesAgo", { count: minutes });
  };

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
            disabled={updateAutomation.isPending || automationId === "new"}
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
                    disabled={!isActive && !canActivate}
                  />
                </span>
              </TooltipTrigger>
              {!isActive && !canActivate && (
                <TooltipContent side="bottom">
                  {t("automationBuilder.header.simulationRequiredTooltip")}
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteAutomation.isPending || automationId === "new"}
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
        onRetry={() => retry(nodes)}
      />
    </TooltipProvider>
  );
};
