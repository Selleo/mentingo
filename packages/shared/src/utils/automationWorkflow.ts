import {
  AUTOMATION_VALIDATION_ISSUE_CODES,
  type AutomationValidationIssueCode,
  AUTOMATION_EVENT_KINDS,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
} from "../constants/automations";
import { resolveAutomationEventFieldSourceKey } from "../constants/automationEventVariables";
import { deriveAutomationBranchFieldValues } from "../constants/automationEmailBranches";

import type {
  AutomationStep,
  AutomationWorkflow,
  AutomationWorkflowIssue,
  AutomationPlaceholderValue,
  AutomationStepTrace,
} from "../types/automations";

export type AutomationWorkflowValidationOptions = {
  requireComplete?: boolean;
  allowBranches?: boolean;
  automationId?: string;
};

/** Structural checks apply to drafts too; publication adds configuration checks. */
export const getAutomationWorkflowIssues = (
  workflow: AutomationWorkflow,
  options: AutomationWorkflowValidationOptions = {},
): AutomationWorkflowIssue[] => {
  const issues: AutomationWorkflowIssue[] = [];
  const addValidationIssue = (
    code: AutomationValidationIssueCode,
    message: string,
    stepId?: string,
  ) => {
    issues.push({ code, message, ...(stepId ? { stepId } : {}) });
  };
  if (workflow.steps.length === 0) {
    if (workflow.rootStepId !== null)
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_ROOT,
        "An empty workflow cannot reference a root.",
      );
    if (options.requireComplete)
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_TRIGGER,
        "Select a starting event.",
      );
    return issues;
  }

  const byId = new Map<string, AutomationStep>();
  const children = new Map<string, AutomationStep[]>();
  for (const step of workflow.steps) {
    if (!step.id || byId.has(step.id))
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.DUPLICATE_STEP_ID,
        "Step identities must be unique and nonempty.",
        step.id,
      );
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(step.id))
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_STEP_ID,
        "Step identities must be UUIDs.",
        step.id,
      );
    byId.set(step.id, step);
    if (options.automationId && step.automationId && step.automationId !== options.automationId) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.CROSS_AUTOMATION_REFERENCE,
        "The step belongs to another automation.",
        step.id,
      );
    }
    if (!Number.isSafeInteger(step.position) || step.position < 0) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_POSITION,
        "Sibling positions must be nonnegative integers.",
        step.id,
      );
    }
    if (step.parentId !== null) {
      const siblings = children.get(step.parentId) ?? [];
      siblings.push(step);
      children.set(step.parentId, siblings);
    }
    const stepType: string = step.type;
    if (stepType !== "trigger" && stepType !== "send_email" && stepType !== "condition") {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.UNSUPPORTED_STEP_TYPE,
        "This step type is not supported.",
        step.id,
      );
    }
  }
  const roots = workflow.steps.filter((step) => step.parentId === null);
  if (roots.length !== 1 || roots[0]?.id !== workflow.rootStepId) {
    addValidationIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_ROOT,
      "The workflow must have exactly one root matching rootStepId.",
    );
  }
  const root = workflow.rootStepId === null ? undefined : byId.get(workflow.rootStepId);
  if (!root || root.type !== "trigger")
    addValidationIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_TRIGGER_ROOT,
      "The root must be a trigger.",
    );
  if (root && root.position !== 0)
    addValidationIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_POSITION,
      "The root position must be zero.",
      root.id,
    );
  for (const step of workflow.steps) {
    if (step.type === "trigger" && step.id !== workflow.rootStepId) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.NON_ROOT_TRIGGER,
        "Only the root can be a trigger.",
        step.id,
      );
    }
    if (step.parentId === step.id)
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.SELF_PARENT,
        "A step cannot be its own parent.",
        step.id,
      );
    if (step.parentId !== null && !byId.has(step.parentId)) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_PARENT,
        "The parent must exist in this workflow.",
        step.id,
      );
    }
    const ancestors = new Set<string>();
    let current: AutomationStep | undefined = step;
    while (current) {
      if (ancestors.has(current.id)) {
        addValidationIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.CYCLE,
          "The workflow cannot contain cycles.",
          step.id,
        );
        break;
      }
      ancestors.add(current.id);
      if (current.parentId === null) break;
      current = byId.get(current.parentId);
    }
    if (options.requireComplete && step.type === "trigger") {
      if (
        !step.config.eventKind ||
        !Object.values(AUTOMATION_EVENT_KINDS).includes(step.config.eventKind)
      ) {
        addValidationIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_EVENT,
          "Select a supported starting event.",
          step.id,
        );
      }
    }
    if (options.requireComplete && step.type === "condition" && !step.config.field) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_CONDITION_FIELD,
        "Choose a Yes/No field for this condition.",
        step.id,
      );
    }
    if (options.requireComplete && step.type === "send_email") {
      const reference = step.config.template;
      if (!reference) {
        addValidationIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_TEMPLATE,
          "Select an email template.",
          step.id,
        );
      } else if (reference.type === "builtin") {
        if (!Object.values(BUILT_IN_EMAIL_TEMPLATE_KEYS).includes(reference.key)) {
          addValidationIssue(
            AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_TEMPLATE,
            "Select a supported built-in template.",
            step.id,
          );
        }
      } else if (reference.type === "custom") {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            reference.id,
          )
        ) {
          addValidationIssue(
            AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_TEMPLATE,
            "Custom templates require a UUID.",
            step.id,
          );
        }
      } else {
        addValidationIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_TEMPLATE,
          "Unsupported template reference.",
          step.id,
        );
      }
    }
  }
  for (const [parentId, siblings] of children) {
    const parent = byId.get(parentId);
    const positions = siblings.map((step) => step.position);
    if (parent?.type === "condition") {
      // 0 = Yes, 1 = No; either branch may end without a successor.
      if (
        new Set(positions).size !== positions.length ||
        positions.some((position) => position !== 0 && position !== 1)
      ) {
        addValidationIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_BRANCHES,
          "A condition can have one Yes branch and one No branch.",
          parentId,
        );
      }
    } else if (siblings.length > 1 || positions[0] !== 0) {
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_SUCCESSOR,
        "This step can have only one successor at position zero.",
        parentId,
      );
    }
  }
  const reachable = new Set<string>();
  const markReachableSteps = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of children.get(id) ?? []) markReachableSteps(child.id);
  };
  if (root) markReachableSteps(root.id);
  for (const step of workflow.steps) {
    if (!reachable.has(step.id))
      addValidationIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.DISCONNECTED_STEP,
        "Every step must be reachable from the root.",
        step.id,
      );
  }
  if (options.requireComplete && !workflow.steps.some((step) => step.type === "send_email")) {
    addValidationIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_ACTION,
      "Add at least one email action.",
    );
  }
  return issues;
};

/** Stable tree order for validation, dependency checks, and display, including both branches. */
export const flattenAutomationWorkflow = (workflow: AutomationWorkflow): AutomationStep[] => {
  const issues = getAutomationWorkflowIssues(workflow);
  if (issues.length) throw new Error(issues[0]!.message);
  const path: AutomationStep[] = [];
  const appendStepAndDescendants = (id: string) => {
    const step = workflow.steps.find((item) => item.id === id)!;
    path.push(step);
    for (const child of getChildrenInExecutionOrder(workflow, id))
      appendStepAndDescendants(child.id);
  };
  if (workflow.rootStepId) appendStepAndDescendants(workflow.rootStepId);
  return path;
};

/** Evaluate strict booleans only; missing/null/string values must never mean No. */
export const evaluateAutomationWorkflow = (
  workflow: AutomationWorkflow,
  fields: Record<string, AutomationPlaceholderValue>,
): { path: AutomationStep[]; steps: AutomationStepTrace[]; issue?: AutomationWorkflowIssue } => {
  const ordered = flattenAutomationWorkflow(workflow);
  const root = ordered[0];
  if (root?.type === "trigger" && root.config.eventKind)
    fields = { ...deriveAutomationBranchFieldValues(root.config.eventKind, fields), ...fields };
  const path: AutomationStep[] = [];
  const traces = new Map(
    ordered.map((step) => [
      step.id,
      {
        stepId: step.id,
        type: step.type,
        ...(step.type === "condition" ? { field: step.config.field } : {}),
        matchedCount: 0,
        skippedCount: 1,
        failedCount: 0,
        trueCount: 0,
        falseCount: 0,
      } as AutomationStepTrace,
    ]),
  );
  let current = ordered[0];
  let issue: AutomationWorkflowIssue | undefined;
  while (current) {
    const trace = traces.get(current.id)!;
    trace.skippedCount = 0;
    path.push(current);
    let position = 0;
    if (current.type === "condition") {
      const field = current.config.field;
      const trigger = ordered[0];
      const sourceKey =
        field && trigger?.type === "trigger" && trigger.config.eventKind
          ? resolveAutomationEventFieldSourceKey(trigger.config.eventKind, field)
          : undefined;
      const value = field
        ? (fields[field] ?? (sourceKey ? fields[sourceKey] : undefined))
        : undefined;
      if (typeof value !== "boolean") {
        trace.failedCount = 1;
        issue = {
          code: AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_VALUE,
          message: "The condition needs a Yes/No value from the event.",
          stepId: current.id,
        };
        break;
      }
      trace.trueCount = Number(value);
      trace.falseCount = Number(!value);
      position = value ? 0 : 1;
    }
    trace.matchedCount = 1;
    current = ordered.find((step) => step.parentId === current!.id && step.position === position)!;
  }
  return { path, steps: [...traces.values()], ...(issue ? { issue } : {}) };
};

const cloneAutomationWorkflow = (workflow: AutomationWorkflow): AutomationWorkflow =>
  JSON.parse(JSON.stringify(workflow)) as AutomationWorkflow;

const assertValidWorkflowStructure = (workflow: AutomationWorkflow) => {
  const issues = getAutomationWorkflowIssues(workflow, { allowBranches: true });
  if (issues.length) throw new Error(issues[0]!.message);
};

const getChildrenInExecutionOrder = (workflow: AutomationWorkflow, parentId: string | null) =>
  workflow.steps
    .filter((step) => step.parentId === parentId)
    .sort((a, b) => a.position - b.position);

/** Inserts into a successor path without replacing the identities of existing steps. */
export const insertAutomationStep = (
  workflow: AutomationWorkflow,
  parentId: string,
  step: AutomationStep,
  position = 0,
): AutomationWorkflow => {
  assertValidWorkflowStructure(workflow);
  if (workflow.steps.some((item) => item.id === step.id))
    throw new Error("Step identity already exists.");
  if (!workflow.steps.some((item) => item.id === parentId))
    throw new Error("Parent step does not exist.");
  if (step.type === "trigger") throw new Error("Triggers can only be the root.");
  const result = cloneAutomationWorkflow(workflow);
  for (const child of getChildrenInExecutionOrder(result, parentId).filter(
    (child) => child.position === position,
  )) {
    child.parentId = step.id;
    child.position = 0;
  }
  result.steps.push({ ...JSON.parse(JSON.stringify(step)), parentId, position } as AutomationStep);
  assertValidWorkflowStructure(result);
  return result;
};

/** Removing an action promotes its successors, preserving the remaining path. */
export const deleteAutomationStep = (
  workflow: AutomationWorkflow,
  stepId: string,
): AutomationWorkflow => {
  assertValidWorkflowStructure(workflow);
  const result = cloneAutomationWorkflow(workflow);
  const step = result.steps.find((item) => item.id === stepId);
  if (!step) throw new Error("Step does not exist.");
  if (step.id === result.rootStepId) throw new Error("The starting trigger cannot be deleted.");
  if (step.type === "condition") {
    const removed = new Set([step.id]);
    const collectDescendantStepIds = (parentId: string) => {
      for (const child of getChildrenInExecutionOrder(result, parentId)) {
        removed.add(child.id);
        collectDescendantStepIds(child.id);
      }
    };
    collectDescendantStepIds(step.id);
    result.steps = result.steps.filter((item) => !removed.has(item.id));
  } else {
    for (const child of getChildrenInExecutionOrder(result, step.id)) {
      child.parentId = step.parentId;
      child.position = step.position;
    }
    result.steps = result.steps.filter((item) => item.id !== stepId);
  }
  assertValidWorkflowStructure(result);
  return result;
};

/** Moves a subtree; cycles, foreign parents, and root reparenting are rejected. */
export const reparentAutomationStep = (
  workflow: AutomationWorkflow,
  stepId: string,
  parentId: string,
  position = 0,
): AutomationWorkflow => {
  assertValidWorkflowStructure(workflow);
  if (!Number.isSafeInteger(position) || position < 0) throw new Error("Invalid sibling position.");
  const result = cloneAutomationWorkflow(workflow);
  const step = result.steps.find((item) => item.id === stepId);
  if (!step || !result.steps.some((item) => item.id === parentId))
    throw new Error("Step or parent does not exist.");
  if (step.id === result.rootStepId) throw new Error("The root cannot be reparented.");
  const parent = result.steps.find((item) => item.id === parentId)!;
  if (parent.type === "condition" ? position > 1 : position !== 0)
    throw new Error("Invalid branch position.");
  if (
    result.steps.some(
      (item) => item.id !== stepId && item.parentId === parentId && item.position === position,
    )
  ) {
    throw new Error("The destination already has a successor.");
  }
  step.parentId = parentId;
  step.position = position;
  assertValidWorkflowStructure(result);
  return result;
};

/** Duplicates a complete draft with new identities supplied by the caller. */
export const duplicateAutomationWorkflow = (
  workflow: AutomationWorkflow,
  createId: (oldId: string) => string,
  automationId?: string,
): AutomationWorkflow => {
  assertValidWorkflowStructure(workflow);
  const result = cloneAutomationWorkflow(workflow);
  const identities = new Map(result.steps.map((step) => [step.id, createId(step.id)]));
  const existing = new Set(workflow.steps.map((step) => step.id));
  if (
    new Set(identities.values()).size !== identities.size ||
    [...identities.values()].some((id) => !id || existing.has(id))
  ) {
    throw new Error("Duplicated steps require new, unique identities.");
  }
  result.rootStepId = workflow.rootStepId === null ? null : identities.get(workflow.rootStepId)!;
  for (const step of result.steps) {
    step.id = identities.get(step.id)!;
    step.parentId = step.parentId === null ? null : identities.get(step.parentId)!;
    delete step.automationId;
    if (automationId) step.automationId = automationId;
  }
  assertValidWorkflowStructure(result);
  return result;
};
