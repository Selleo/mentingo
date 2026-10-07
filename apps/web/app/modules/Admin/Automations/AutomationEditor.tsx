import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@remix-run/react";
import {
  getCanonicalAutomationField,
  AUTOMATION_STATUSES,
  AUTOMATION_STEP_TYPES,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteAutomation } from "~/api/mutations/automations/useDeleteAutomation";
import { useAutomationEvents } from "~/api/queries/useAutomationEvents";
import { useAutomationOverlaps } from "~/api/queries/useAutomationOverlaps";
import { useAutomationTemplates } from "~/api/queries/useAutomationTemplates";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { cn } from "~/lib/utils";

import { BlocksSidebar } from "./Builder/components/BlocksSidebar";
import { BuilderCanvas } from "./Builder/components/BuilderCanvas";
import { BuilderExitDialogs } from "./Builder/components/BuilderExitDialogs";
import { BuilderHeader } from "./Builder/components/BuilderHeader";
import { EditNodePanel } from "./Builder/components/EditNodePanel";
import { SimulationPanel } from "./Builder/components/SimulationPanel";
import { useAutomationEditor } from "./Builder/hooks/useAutomationEditor";
import { getBooleanConditionFieldOptions } from "./Builder/utils/conditionFields";
import { serializeAutomationTemplateReference } from "./Builder/utils/templateReference";
import { DeleteAutomationDialog } from "./components/DeleteAutomationDialog";

import type { BuilderBlock } from "./Builder/builder.types";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { AutomationDto, AutomationStep } from "@repo/shared";

export function AutomationEditor({ automation }: { automation?: AutomationDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    definition,
    selectedStepId,
    setSelectedStepId,
    isReadonly,
    isBusy: isEditorBusy,
    hasUnsavedChanges,
    issues,
    simulation,
    simulationOpen,
    simulationValues,
    setSimulationOpen,
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
  } = useAutomationEditor(automation);
  const { mutateAsync: deleteAutomation, isPending: isDeleting } = useDeleteAutomation();
  const isBusy = isEditorBusy || isDeleting;
  const [isConfigurationValid, setIsConfigurationValid] = useState(true);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchPosition, setBranchPosition] = useState<number | undefined>();
  const [branchGuidance, setBranchGuidance] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<BuilderBlock | null>(null);
  const {
    data: events = [],
    isPending: loadingEvents,
    isError: eventsError,
  } = useAutomationEvents();
  const {
    data: templates = [],
    isPending: loadingTemplates,
    isError: templatesError,
  } = useAutomationTemplates();
  const selectedStep = definition.workflow.steps.find((step) => step.id === selectedStepId);
  const triggerStep = definition.workflow.steps.find(
    (step) => step.id === definition.workflow.rootStepId,
  );
  const eventKind =
    triggerStep?.type === AUTOMATION_STEP_TYPES.TRIGGER ? triggerStep.config.eventKind : null;
  const selectedEvent = events.find((event) => event.kind === eventKind);
  const { data: overlappingAutomations = [] } = useAutomationOverlaps(eventKind, automation?.id);
  const isEditingDisabled = isReadonly || isBusy;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const status = automation?.status ?? AUTOMATION_STATUSES.DRAFT;
  const canEnable =
    !hasUnsavedChanges &&
    !automation?.hasUnappliedChanges &&
    Boolean(automation?.appliedDefinition);

  const emailSteps = definition.workflow.steps.filter(
    (step) => step.type === AUTOMATION_STEP_TYPES.SEND_EMAIL,
  );

  function getCreationGuidance() {
    if (!triggerStep) return t("automationBuilder.creation.chooseTrigger");
    if (!emailSteps.length) return t("automationBuilder.creation.addEmail");
    if (
      emailSteps.some(
        (step) => step.type === AUTOMATION_STEP_TYPES.SEND_EMAIL && !step.config.template,
      )
    )
      return t("automationBuilder.creation.configureEmail");
    if (!canEnable && status !== AUTOMATION_STATUSES.ENABLED)
      return t("automationBuilder.creation.applyAndEnable");

    return t("automationBuilder.creation.manageWorkflow");
  }

  function selectSidebarBlock(block: BuilderBlock) {
    if (isEditingDisabled) return;

    if (block.type === AUTOMATION_STEP_TYPES.TRIGGER && block.eventKind) {
      insertTriggerStep(block.eventKind);
      setSelectedStepId(null);

      return;
    }

    const lastStep = definition.workflow.steps.find(
      (step) => !definition.workflow.steps.some((child) => child.parentId === step.id),
    );

    const target = selectedStep ?? lastStep;
    if (target?.type === AUTOMATION_STEP_TYPES.CONDITION) {
      setBranchGuidance(true);
      return;
    }
    if (target && block.type !== AUTOMATION_STEP_TYPES.TRIGGER)
      insertEmailStep(target.id, block.type);
  }

  function getStepLabel(step: AutomationStep) {
    if (step.type === AUTOMATION_STEP_TYPES.CONDITION) {
      const field = getBooleanConditionFieldOptions(selectedEvent).find(
        (field) =>
          selectedEvent &&
          getCanonicalAutomationField(selectedEvent, field.key) ===
            getCanonicalAutomationField(selectedEvent, step.config.field ?? ""),
      );
      return field
        ? t(field.labelKey, { defaultValue: field.label })
        : t("automationBuilder.condition.title");
    }
    if (step.type === AUTOMATION_STEP_TYPES.TRIGGER) {
      if (!step.config.eventKind) return t("automations.selectEvent");

      return t(`emailTemplates.events.${step.config.eventKind}`, {
        defaultValue:
          events.find((event) => event.kind === step.config.eventKind)?.label ??
          step.config.eventKind,
      });
    }

    const template = templates.find(
      (item) =>
        step.config.template &&
        serializeAutomationTemplateReference(item.reference) ===
          serializeAutomationTemplateReference(step.config.template),
    );

    if (template?.reference.type === "builtin")
      return t(`emailTemplates.events.${template.reference.key}`, { defaultValue: template.name });

    return template?.name ?? t("automations.sendEmail");
  }

  function navigateBack() {
    navigate("/admin/automations");
  }

  function handleBack() {
    if (hasUnsavedChanges) setIsLeaveDialogOpen(true);
    else navigateBack();
  }

  async function deleteAndLeave() {
    if (!automation || isBusy) return;

    await deleteAutomation(automation.id);

    setIsDeleteDialogOpen(false);
    navigateBack();
  }

  async function saveAndLeave() {
    if (!isConfigurationValid) return;

    const saved = await saveDraft();

    if (saved) navigateBack();
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggedBlock((event.active.data.current?.block as BuilderBlock | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedBlock(null);

    if (isEditingDisabled || !event.over) return;

    const block = event.active.data.current?.block as BuilderBlock | undefined;

    if (!block) return;

    if (event.over.id === "canvas-root") {
      if (
        block.type === AUTOMATION_STEP_TYPES.TRIGGER &&
        block.eventKind &&
        events.some((item) => item.kind === block.eventKind)
      )
        insertTriggerStep(block.eventKind);
      return;
    }

    const parentStepId = event.over.data.current?.parentStepId as string | undefined;

    if (parentStepId && block.type !== AUTOMATION_STEP_TYPES.TRIGGER)
      insertEmailStep(parentStepId, block.type, Number(event.over.data.current?.position ?? 0));
  }

  if (eventsError || templatesError)
    return (
      <ErrorPage
        title={t("automations.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden" data-testid="automation-editor">
      <BuilderHeader
        name={definition.name}
        description={definition.description}
        status={status}
        busy={isBusy || !isConfigurationValid}
        simulating={isSimulating}
        readonly={isEditingDisabled}
        hasUnsavedChanges={hasUnsavedChanges}
        hasUnappliedChanges={Boolean(automation?.hasUnappliedChanges)}
        toggleDisabled={
          isBusy ||
          !isConfigurationValid ||
          isReadonly ||
          (status !== AUTOMATION_STATUSES.ENABLED && !canEnable)
        }
        archiveDisabled={isBusy || !automation || isReadonly}
        deleteDisabled={isBusy || !automation}
        onNameChange={(name) => updateDefinition({ ...definition, name })}
        onDescriptionChange={(description) => updateDefinition({ ...definition, description })}
        onBack={handleBack}
        onSave={() => void saveDraft().catch(() => undefined)}
        onApply={() => void applySavedDraft().catch(() => undefined)}
        onSimulate={() => void runSimulation().catch(() => undefined)}
        onToggle={() => void toggleEnabled().catch(() => undefined)}
        onArchive={() => setIsArchiveDialogOpen(true)}
        onDelete={() => setIsDeleteDialogOpen(true)}
      />
      {issues.length > 0 && (
        <div role="alert" className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedBlock(null)}
      >
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white sm:flex-row">
          <BlocksSidebar
            hasTrigger={Boolean(triggerStep)}
            guidance={
              branchGuidance ? t("automationBuilder.condition.chooseBranch") : getCreationGuidance()
            }
            onSelectBlock={selectSidebarBlock}
            events={events}
            disabled={isEditingDisabled}
            loading={loadingEvents}
          />
          <BuilderCanvas
            overlappingAutomationNames={overlappingAutomations.map((item) => item.name)}
            workflow={definition.workflow}
            selectedId={selectedStepId}
            readonly={isEditingDisabled}
            labelFor={getStepLabel}
            onSelect={(id) => {
              setBranchPosition(undefined);
              setSelectedStepId(id);
            }}
            onSelectBranch={(id, position) => {
              setBranchPosition(position);
              setSelectedStepId(id);
            }}
            onAdd={(id, type, position) => {
              setBranchGuidance(false);
              insertEmailStep(id, type, position);
            }}
            onRemove={removeStep}
          />
          <EditNodePanel
            key={`${selectedStepId}:${branchPosition}`}
            workflow={definition.workflow}
            branchPosition={branchPosition}
            node={selectedStep}
            label={selectedStep ? getStepLabel(selectedStep) : ""}
            events={events}
            event={selectedEvent}
            templates={templates}
            loadingTemplates={loadingTemplates}
            readonly={isEditingDisabled}
            onClose={() => setSelectedStepId(null)}
            onSaveStep={updateStep}
            onConfigurationValidityChange={setIsConfigurationValid}
            onRemove={removeStep}
            onChangeTrigger={(kind) => {
              if (!triggerStep || triggerStep.type !== AUTOMATION_STEP_TYPES.TRIGGER) return;

              updateDefinition({
                ...definition,
                workflow: {
                  rootStepId: triggerStep.id,
                  steps: [{ ...triggerStep, config: { eventKind: kind } }],
                },
              });
            }}
          />
        </div>
        <DragOverlay>
          {draggedBlock && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm shadow-lg",
                "select-none border-neutral-200 bg-white",
              )}
            >
              <span className="font-medium">{draggedBlock.label}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <SimulationPanel
        key={JSON.stringify(simulationValues)}
        sampleValues={simulationValues}
        open={simulationOpen}
        loading={isSimulating}
        result={simulation}
        event={selectedEvent}
        workflow={definition.workflow}
        onClose={() => setSimulationOpen(false)}
        onSimulate={(values) => void runSimulation(values).catch(() => undefined)}
      />
      <BuilderExitDialogs
        name={definition.name}
        busy={isBusy || !isConfigurationValid}
        leaveOpen={isLeaveDialogOpen}
        archiveOpen={isArchiveDialogOpen}
        onLeaveOpenChange={setIsLeaveDialogOpen}
        onArchiveOpenChange={setIsArchiveDialogOpen}
        onLeave={navigateBack}
        onSaveAndLeave={() => void saveAndLeave().catch(() => undefined)}
        onArchive={() => void archiveAutomation().catch(() => undefined)}
      />
      <DeleteAutomationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        onConfirm={() => void deleteAndLeave().catch(() => undefined)}
      />
    </div>
  );
}
