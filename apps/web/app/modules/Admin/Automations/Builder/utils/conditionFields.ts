import { AUTOMATION_GROUP_CONDITION_FIELDS, AUTOMATION_PLACEHOLDER_TYPES } from "@repo/shared";

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

export function getConditionFieldOptions(event?: AutomationEventDefinition) {
  const groupField = event ? AUTOMATION_GROUP_CONDITION_FIELDS[event.kind] : undefined;

  const groupFieldOptions = groupField
    ? [
        {
          key: groupField,
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          label: "Group",
          labelKey: "automationBuilder.condition.group",
          sampleValue: undefined,
        },
      ]
    : [];

  return [...getBooleanConditionFieldOptions(event), ...groupFieldOptions];
}
