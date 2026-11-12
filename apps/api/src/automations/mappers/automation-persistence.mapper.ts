import {
  AUTOMATION_DEFINITION_KINDS,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_RECIPIENT_AUDIENCES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STEP_TYPES,
  type AutomationDefinitionKind,
  type AutomationStep,
  type AutomationStepConfiguration,
  type AutomationWorkflow,
} from "@repo/shared";
import { match, P } from "ts-pattern";

import type { AutomationRecord, LocalizedAutomationRow } from "../automation.types";
import type { automationSteps } from "src/storage/schema";

type AutomationRow = LocalizedAutomationRow;
type AutomationStepRow = typeof automationSteps.$inferSelect;

export const serializeAutomationStepConfiguration = (
  step: AutomationStep,
): AutomationStepConfiguration => {
  if (step.type === AUTOMATION_STEP_TYPES.TRIGGER) {
    return {
      name: step.config.eventKind ?? null,
    };
  }

  if (step.type === AUTOMATION_STEP_TYPES.CONDITION) {
    return { name: AUTOMATION_STEP_TYPES.CONDITION, ...step.config };
  }

  return { name: AUTOMATION_STEP_TYPES.SEND_EMAIL, ...step.config };
};

export const assembleAutomationRecordFromRows = (
  automation: AutomationRow,
  steps: AutomationStepRow[],
): AutomationRecord => {
  const { name, description, localizedAppliedName, localizedAppliedDescription, ...metadata } =
    automation;

  const hasLegacyAppliedAdminCourseCompletionTrigger = steps.some(
    (step) =>
      step.automationId === automation.id &&
      step.definitionKind === AUTOMATION_DEFINITION_KINDS.APPLIED &&
      step.id === automation.appliedRootStepId &&
      isLegacyAdminCourseCompletionTriggerRow(step),
  );

  return {
    ...metadata,
    legacyAppliedEventKind: hasLegacyAppliedAdminCourseCompletionTrigger
      ? AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE
      : undefined,
    name,
    description,
    draftDefinition: {
      name,
      description,
      workflow: buildWorkflowFromStepRows(automation, steps, AUTOMATION_DEFINITION_KINDS.DRAFT),
    },
    appliedDefinition: automation.appliedName
      ? {
          name: localizedAppliedName ?? "",
          description: localizedAppliedDescription ?? "",
          workflow: buildWorkflowFromStepRows(
            automation,
            steps,
            AUTOMATION_DEFINITION_KINDS.APPLIED,
          ),
        }
      : null,
  };
};

function buildWorkflowFromStepRows(
  automation: AutomationRow,
  steps: AutomationStepRow[],
  definitionKind: AutomationDefinitionKind,
): AutomationWorkflow {
  const definitionSteps = steps
    .filter((step) => step.automationId === automation.id && step.definitionKind === definitionKind)
    .sort((left, right) => left.id.localeCompare(right.id));

  const hasLegacyAdminCourseCompletionTrigger = definitionSteps.some(
    isLegacyAdminCourseCompletionTriggerRow,
  );

  return {
    rootStepId:
      definitionKind === AUTOMATION_DEFINITION_KINDS.DRAFT
        ? automation.draftRootStepId
        : automation.appliedRootStepId,
    steps: definitionSteps.map((row) => {
      const step = deserializeAutomationStep(row);

      return hasLegacyAdminCourseCompletionTrigger
        ? migrateLegacyAdminCourseCompletionStep(step)
        : step;
    }),
  };
}

function isLegacyAdminCourseCompletionTriggerRow(step: AutomationStepRow): boolean {
  return (
    step.nodeKind === AUTOMATION_NODE_KINDS.TRIGGER &&
    step.configuration.name === AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE
  );
}

/**
 * Moves a workflow saved on the retired administrator-only course completion trigger onto the
 * shared trigger. Templates, mappings and explicitly selected recipients are kept; event
 * recipients become administrators. Saving the workflow persists the migrated form.
 */
function migrateLegacyAdminCourseCompletionStep(step: AutomationStep): AutomationStep {
  return match(step)
    .with(
      {
        type: AUTOMATION_STEP_TYPES.TRIGGER,
        config: { eventKind: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE },
      },
      (triggerStep) => ({
        ...triggerStep,
        config: { eventKind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE },
      }),
    )
    .with(
      {
        type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
        config: { recipients: P.optional({ type: AUTOMATION_RECIPIENT_TYPES.EVENT }) },
      },
      (emailStep) => ({
        ...emailStep,
        config: {
          ...emailStep.config,
          recipients: {
            type: AUTOMATION_RECIPIENT_TYPES.EVENT,
            audience: AUTOMATION_RECIPIENT_AUDIENCES.ADMINISTRATORS,
          },
        },
      }),
    )
    .otherwise(() => step);
}

function deserializeAutomationStep(step: AutomationStepRow): AutomationStep {
  const identity = { id: step.id, parentId: step.parentId, position: step.position };

  if (
    step.nodeKind === AUTOMATION_NODE_KINDS.TRIGGER &&
    step.configuration.name !== AUTOMATION_STEP_TYPES.SEND_EMAIL &&
    step.configuration.name !== AUTOMATION_STEP_TYPES.CONDITION
  ) {
    return {
      ...identity,
      type: AUTOMATION_STEP_TYPES.TRIGGER,
      config: { eventKind: step.configuration.name },
    };
  }

  if (
    step.nodeKind === AUTOMATION_NODE_KINDS.CONDITION &&
    step.configuration.name === AUTOMATION_STEP_TYPES.CONDITION
  ) {
    return {
      ...identity,
      type: AUTOMATION_STEP_TYPES.CONDITION,
      config: { field: step.configuration.field, equals: step.configuration.equals },
    };
  }

  if (
    step.nodeKind !== AUTOMATION_NODE_KINDS.ACTION ||
    step.configuration.name !== AUTOMATION_STEP_TYPES.SEND_EMAIL
  ) {
    throw new Error("Automation action context is invalid");
  }

  return {
    ...identity,
    type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
    config: {
      template: step.configuration.template,
      mappings: step.configuration.mappings,
      recipients: step.configuration.recipients,
    },
  };
}
