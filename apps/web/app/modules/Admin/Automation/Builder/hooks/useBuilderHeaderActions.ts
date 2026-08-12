import { useNavigate } from "@remix-run/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteAutomation } from "~/api/mutations/admin/useDeleteAutomation";
import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useBuilderStore } from "../automationBuilderStore";

import { useSaveAutomationSteps } from "./useSaveAutomationSteps";
import { useSimulation } from "./useSimulation";
import { useSimulationPersistence } from "./useSimulationPersistence";

import type { AutomationStatus } from "~/api/queries/admin/automation.types";

interface UseBuilderHeaderActionsParams {
  automationId: string;
}

export function useBuilderHeaderActions({ automationId }: UseBuilderHeaderActionsParams) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const navigate = useNavigate();

  const automationName = useBuilderStore((s) => s.automationName);
  const isActive = useBuilderStore((s) => s.isActive);
  const status = useBuilderStore((s) => s.status);
  const simulationPassed = useBuilderStore((s) => s.simulationPassed);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const nodes = useBuilderStore((s) => s.nodes);
  const setStatus = useBuilderStore((s) => s.setStatus);

  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const { saveSteps } = useSaveAutomationSteps();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { simulationState, isSimulating, panelOpen, runSimulation, closePanel, retry } =
    useSimulation();

  useSimulationPersistence(simulationState, automationId);

  const handleSave = useCallback(async () => {
    if (automationId === "new") return false;

    const { automationName: name, status } = useBuilderStore.getState();

    await saveSteps({ name: { [language]: name }, status });
    return true;
  }, [automationId, language, saveSteps]);

  const handleBack = useCallback(() => {
    if (useBuilderStore.getState().isDirty) {
      setShowLeaveDialog(true);
    } else {
      navigate("/admin/automation");
    }
  }, [navigate]);

  const handleSaveAndLeave = useCallback(async () => {
    try {
      const saved = await handleSave();
      if (!saved) return;
      setShowLeaveDialog(false);
      navigate("/admin/automation");
    } catch {
      // The mutation owns the translated error toast; keep the dialog and dirty state open.
    }
  }, [handleSave, navigate]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setShowLeaveDialog(false);
    navigate("/admin/automation");
  }, [navigate]);

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

  const handleSimulate = useCallback(() => {
    if (automationId === "new") return;
    const currentNodes = useBuilderStore.getState().nodes;
    runSimulation(currentNodes);
  }, [automationId, runSimulation]);

  const handleRetrySimulation = useCallback(() => {
    const currentNodes = useBuilderStore.getState().nodes;
    retry(currentNodes);
  }, [retry]);

  const simulationJustPassed =
    simulationState.type === "success" && simulationState.result.overallStatus === "success";

  const hasInvalidNodes = nodes.some((n) => n.config?.simulationStatus === "invalid");

  const canActivate = !hasInvalidNodes && (simulationPassed || simulationJustPassed);
  const toggleDisabled = isDirty || hasInvalidNodes || (!isActive && !canActivate);

  const handleToggleActive = useCallback(
    (active: boolean) => {
      if (active && (useBuilderStore.getState().isDirty || !canActivate || hasInvalidNodes)) return;

      const nextStatus: AutomationStatus = active ? "enabled" : "disabled";
      setStatus(nextStatus);

      if (automationId !== "new") {
        updateAutomation.mutate({ automationId, body: { status: nextStatus } });
      }
    },
    [automationId, canActivate, hasInvalidNodes, setStatus, updateAutomation],
  );

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
    automationName,
    isActive,
    status,
    isDirty,
    lastSavedAt,
    toggleDisabled,
    showLeaveDialog,
    showDeleteDialog,
    simulationState,
    isSimulating,
    panelOpen,
    nodes,

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

    isSavePending: updateAutomation.isPending,
    isDeletePending: deleteAutomation.isPending,
  };
}
