import type { AutomationEventDefinition, AutomationProvidedVariable } from "@repo/shared";

/** Only the audited public vocabulary is offered for new mappings. */
export function getSelectableAutomationVariables(
  event?: AutomationEventDefinition,
): AutomationProvidedVariable[] {
  return event?.providedVariables ?? [];
}
