import type { AutomationEventDefinition, AutomationWorkflow } from "../types/automations";
import { getCanonicalAutomationField } from "../constants/automationEmailBranches";

/** Ancestor outcomes are facts available to every descendant on that path. */
export function getAncestorConditionOutcomes(
  workflow: AutomationWorkflow,
  stepId: string,
  event: AutomationEventDefinition,
) {
  const facts: Record<string, boolean> = {};
  const visited = new Set<string>();
  let step = workflow.steps.find((step) => step.id === stepId);
  while (step?.parentId && !visited.has(step.id)) {
    visited.add(step.id);
    const parent = workflow.steps.find((candidate) => candidate.id === step!.parentId);
    if (parent?.type === "condition" && parent.config.field) {
      const key = getCanonicalAutomationField(event, parent.config.field);
      if (!(key in facts)) facts[key] = step.position === 0;
    }
    step = parent;
  }
  return facts;
}

export function isAutomationFieldAvailable(
  event: AutomationEventDefinition,
  field: string,
  facts: Record<string, boolean>,
) {
  const definition = event.fields.find(
    (item) => item.key === getCanonicalAutomationField(event, field),
  );
  const rule = definition?.availableWhen;
  return !rule || facts[rule.field] === rule.equals;
}
