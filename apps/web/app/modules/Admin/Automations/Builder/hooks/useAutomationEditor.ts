import { useNavigate } from "@remix-run/react";
import {
  AUTOMATION_STATUSES,
  AUTOMATION_STEP_TYPES,
  deleteAutomationStep,
  insertAutomationStep,
  getAutomationWorkflowIssues,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useApplyAutomation } from "~/api/mutations/automations/useApplyAutomation";
import { useArchiveAutomation } from "~/api/mutations/automations/useArchiveAutomation";
import { useCreateAutomation } from "~/api/mutations/automations/useCreateAutomation";
import { useDisableAutomation } from "~/api/mutations/automations/useDisableAutomation";
import { useEnableAutomation } from "~/api/mutations/automations/useEnableAutomation";
import { useSimulateAutomation } from "~/api/mutations/automations/useSimulateAutomation";
import { useUpdateAutomation } from "~/api/mutations/automations/useUpdateAutomation";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type {
  AutomationEventKind,
  AutomationDefinition,
  AutomationDto,
  AutomationSimulationResult,
  AutomationStep,
  AutomationPlaceholderValue,
} from "@repo/shared";

function createInitialDefinition(automation?: AutomationDto): AutomationDefinition {
  if (automation)
    return {
      name: automation.name,
      description: automation.description,
      workflow: automation.workflow,
    };

  return {
    name: "",
    description: "",
    workflow: {
      rootStepId: null,
      steps: [],
    },
  };
}

export function useAutomationEditor(automation?: AutomationDto) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const [definition, setDefinition] = useState(() => createInitialDefinition(automation));
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [savedDefinition, setSavedDefinition] = useState(() => createInitialDefinition(automation));
  const hasUnsavedChanges = JSON.stringify(definition) !== JSON.stringify(savedDefinition);
  const [issues, setIssues] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<AutomationSimulationResult | null>(null);
  const [simulationValues, setSimulationValues] = useState<
    Record<string, AutomationPlaceholderValue>
  >({});
  const [simulationOpen, setSimulationOpen] = useState(false);
  const { mutateAsync: createAutomation, isPending: isCreating } = useCreateAutomation();
  const { mutateAsync: updateAutomation, isPending: isUpdating } = useUpdateAutomation();
  const { mutateAsync: applyAutomation, isPending: isApplying } = useApplyAutomation();
  const { mutateAsync: enableAutomation, isPending: isEnabling } = useEnableAutomation();
  const { mutateAsync: disableAutomation, isPending: isDisabling } = useDisableAutomation();
  const { mutateAsync: archiveAutomationRecord, isPending: isArchiving } = useArchiveAutomation();
  const { mutateAsync: simulateAutomation, isPending: isSimulating } = useSimulateAutomation();
  const isReadonly = automation?.status === AUTOMATION_STATUSES.ARCHIVED;
  const isBusy =
    isCreating ||
    isUpdating ||
    isApplying ||
    isEnabling ||
    isDisabling ||
    isArchiving ||
    isSimulating;

  function updateDefinition(next: AutomationDefinition) {
    if (isReadonly || isBusy) return;

    setDefinition(next);
    setSimulation(null);
    setSimulationValues({});
  }

  function updateStep(next: AutomationStep) {
    updateDefinition({
      ...definition,
      workflow: {
        ...definition.workflow,
        steps: definition.workflow.steps.map((step) => (step.id === next.id ? next : step)),
      },
    });
  }

  function insertTriggerStep(eventKind: AutomationEventKind) {
    if (definition.workflow.rootStepId || isReadonly || isBusy) return;

    const id = crypto.randomUUID();

    updateDefinition({
      ...definition,
      workflow: {
        rootStepId: id,
        steps: [
          {
            id,
            parentId: null,
            position: 0,
            type: AUTOMATION_STEP_TYPES.TRIGGER,
            config: { eventKind },
          },
        ],
      },
    });
    setSelectedStepId(id);
  }

  function insertEmailStep(
    parentId: string,
    type: "send_email" | "condition" = "send_email",
    position = 0,
  ) {
    if (isReadonly || isBusy) return;

    const id = crypto.randomUUID();
    const workflow = insertAutomationStep(
      definition.workflow,
      parentId,
      {
        id,
        parentId,
        position: 0,
        type,
        config: {},
      },
      position,
    );

    updateDefinition({ ...definition, workflow });
    setSelectedStepId(id);
  }

  function removeStep(id: string) {
    if (isReadonly || isBusy) return;

    if (id === definition.workflow.rootStepId) {
      updateDefinition({ ...definition, workflow: { rootStepId: null, steps: [] } });
      setSelectedStepId(null);
      return;
    }

    updateDefinition({ ...definition, workflow: deleteAutomationStep(definition.workflow, id) });
    setSelectedStepId(null);
  }

  async function saveDraft() {
    if (!definition.name.trim()) {
      setIssues([t("automations.nameRequired")]);
      return null;
    }

    setIssues([]);

    const saved = automation
      ? await updateAutomation({ id: automation.id, data: definition })
      : await createAutomation(definition);

    setSavedDefinition(definition);
    if (!automation) navigate(`/admin/automations/${saved.id}`);

    return saved;
  }

  async function applySavedDraft() {
    const errors = getAutomationWorkflowIssues(definition.workflow, { requireComplete: true });

    if (errors.length) {
      setIssues(
        errors.map((issue) =>
          t(`automationBuilder.condition.issues.${issue.code}`, {
            defaultValue: t("automations.errors.invalidWorkflow"),
          }),
        ),
      );
      return;
    }

    const saved = await saveDraft();

    if (saved) await applyAutomation(saved.id);
  }

  async function runSimulation(
    sampleValues: Record<string, AutomationPlaceholderValue> = simulationValues,
  ) {
    setSimulationValues(sampleValues);
    setSimulationOpen(true);
    setSimulation(null);

    const result = await simulateAutomation({
      workflow: definition.workflow,
      language,
      sampleValues,
    });

    setSimulation(result);
  }

  async function toggleEnabled() {
    if (!automation) return;
    if (automation.status === AUTOMATION_STATUSES.ENABLED) await disableAutomation(automation.id);
    else await enableAutomation(automation.id);
  }

  async function archiveAutomation() {
    if (automation) await archiveAutomationRecord(automation.id);
  }

  return {
    definition,
    selectedStepId,
    setSelectedStepId,
    hasUnsavedChanges,
    issues,
    simulation,
    simulationOpen,
    simulationValues,
    setSimulationOpen,
    isReadonly,
    isBusy,
    isSimulating,
    updateDefinition,
    updateStep,
    insertTriggerStep,
    insertEmailStep,
    removeStep,
    saveDraft,
    applySavedDraft,
    runSimulation,
    toggleEnabled,
    archiveAutomation,
  };
}
