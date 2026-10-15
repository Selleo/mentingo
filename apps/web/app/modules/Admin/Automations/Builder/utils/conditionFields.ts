import type { AutomationEventDefinition } from "@repo/shared";

export function getBooleanConditionFieldOptions(event?: AutomationEventDefinition) {
  return (event?.providedVariables ?? [])
    .filter((variable) => variable.dataType === "boolean")
    .map((variable) => ({
      key: variable.key,
      type: variable.dataType,
      label: variable.label,
      labelKey: variable.labelKey ?? variable.label,
      sampleValue: variable.sampleValue,
    }));
}
