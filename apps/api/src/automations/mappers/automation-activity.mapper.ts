import type { AutomationRecord } from "../automation.types";
import type { AutomationActivitySnapshot } from "src/events/automation/automation-activity-event.types";

export function buildAutomationActivitySnapshot(
  record: AutomationRecord,
): AutomationActivitySnapshot {
  return {
    name: record.name,
    description: record.description,
    status: record.status,
    executionVersion: record.executionVersion,
    draftDefinition: record.draftDefinition,
    appliedDefinition: record.appliedDefinition,
    baseLanguage: record.baseLanguage,
    availableLocales: record.availableLocales,
  };
}
