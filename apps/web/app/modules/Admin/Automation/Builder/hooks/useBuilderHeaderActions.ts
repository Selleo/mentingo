import { useNavigate } from "@remix-run/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteAutomation } from "~/api/mutations/admin/useDeleteAutomation";
import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";

import { useBuilderStore } from "../automationBuilderStore";

import { useSaveAutomationSteps } from "./useSaveAutomationSteps";
import { useSimulation } from "./useSimulation";
import { useSimulationPersistence } from "./useSimulationPersistence";

import type { AutomationStatus } from "~/api/queries/admin/automation.types";

interface UseBuilderHeaderActionsParams {
  automationId: string;
}

export function useBuilderHeaderActions({ automationId }: UseBuilderHeaderActionsParams) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const automationName = useBuilderStore((s) => s.automationName);
  const isActive = useBuilderStore((s) => s.isActive);
  const simulationPassed = useBuilderStore((s) => s.simulationPassed);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const nodes = useBuilderStore((s) => s.nodes);
  const setActive = useBuilderStore((s) => s.setActive);

  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const { saveSteps } = useSaveAutomationSteps();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { simulationState, isSimulating, panelOpen, runSimulation, closePanel, retry } =
    useSimulation();

  // Persist simulation results to node configs and save to backend
  useSimulationPersistence(simulationState, automationId);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (automationId === "new") return;

    const lang = i18n.language || "pl";
    const { automationName: name, isActive: active } = useBuilderStore.getState();
    const status: AutomationStatus = active ? "enabled" : "draft";

    saveSteps({ name: { [lang]: name }, status });
  }, [automationId, i18n.language, saveSteps]);

  // ─── Navigation ────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (useBuilderStore.getState().isDirty) {
      setShowLeaveDialog(true);
    } else {
      navigate("/admin/automation");
    }
  }, [navigate]);

  const handleSaveAndLeave = useCallback(() => {
    handleSave();
    setShowLeaveDialog(false);
    navigate("/admin/automation");
  }, [handleSave, navigate]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setShowLeaveDialog(false);
    navigate("/admin/automation");
  }, [navigate]);

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback(() => {
    if (automationId === "new") return;
    setShowDeleteDialog(true);
  }, [automationId]);

  const handleDeleteConfirm = useCallback(() => {
    setShowDeleteDialog(false);
    deleteAutomation.mutate(automationId, {
      onSuccess: () => {
        navigate("/admin/automation");
      },
    });
  }, [automationId, deleteAutomation, navigate]);

  // ─── Simulation ────────────────────────────────────────────────────────────

  const handleSimulate = useCallback(() => {
    if (automationId === "new") return;
    const currentNodes = useBuilderStore.getState().nodes;
    runSimulation(currentNodes);
  }, [automationId, runSimulation]);

  const handleRetrySimulation = useCallback(() => {
    const currentNodes = useBuilderStore.getState().nodes;
    retry(currentNodes);
  }, [retry]);

  // ─── Toggle active/draft ───────────────────────────────────────────────────

  const simulationJustPassed =
    simulationState.type === "success" && simulationState.result.overallStatus === "success";

  const hasInvalidNodes = nodes.some((n) => n.config?.simulationStatus === "invalid");

  const canActivate = !hasInvalidNodes && (simulationPassed || simulationJustPassed);
  const toggleDisabled = isDirty || hasInvalidNodes || (!isActive && !canActivate);

  const handleToggleActive = useCallback(
    (active: boolean) => {
      if (active && (useBuilderStore.getState().isDirty || !canActivate || hasInvalidNodes)) return;

      setActive(active);

      if (automationId !== "new") {
        const status: AutomationStatus = active ? "enabled" : "draft";
        updateAutomation.mutate({ automationId, body: { status } });
      }
    },
    [automationId, canActivate, hasInvalidNodes, setActive, updateAutomation],
  );

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getToggleTooltip = useCallback((): string | null => {
    if (isDirty) return t("automationBuilder.header.unsavedChangesTooltip");
    if (hasInvalidNodes) return t("automationBuilder.header.invalidNodesTooltip");
    if (!isActive && !canActivate) return t("automationBuilder.header.simulationRequiredTooltip");
    return null;
  }, [isDirty, isActive, canActivate, hasInvalidNodes, t]);

  const formatSavedTime = useCallback((): string | null => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t("automationBuilder.header.savedJustNow");
    return t("automationBuilder.header.savedMinutesAgo", { count: minutes });
  }, [lastSavedAt, t]);

  return {
    // State
    automationName,
    isActive,
    isDirty,
    lastSavedAt,
    toggleDisabled,
    showLeaveDialog,
    showDeleteDialog,
    simulationState,
    isSimulating,
    panelOpen,
    nodes,

    // State setters
    setShowLeaveDialog,
    setShowDeleteDialog,

    // Handlers
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

    // Helpers
    getToggleTooltip,
    formatSavedTime,

    // Mutation states
    isSavePending: updateAutomation.isPending,
    isDeletePending: deleteAutomation.isPending,
  };
}
