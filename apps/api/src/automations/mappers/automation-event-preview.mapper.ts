import { deriveAutomationBranchFieldValues } from "@repo/shared";

import { AUTOMATION_EVENT_CATALOG } from "src/automations/catalog/automation-event-catalog";
import { generateEmailPreviewTagValue } from "src/email-templates/services/email-template-placeholder.utils";

import type {
  AutomationEventDefinition,
  AutomationPlaceholderValue,
  SupportedLanguages,
} from "@repo/shared";

/** Keep catalog tooltips consistent with the seeded data used in simulation. */
export function buildAutomationEventCatalogWithSamples(
  language?: SupportedLanguages,
): AutomationEventDefinition[] {
  return AUTOMATION_EVENT_CATALOG.map((event) => addEventPreviewSamples(event, language));
}

function addEventPreviewSamples(
  event: AutomationEventDefinition,
  language?: SupportedLanguages,
): AutomationEventDefinition {
  const samples = generateEventFieldSamples(event, language);

  return {
    ...event,
    fields: event.fields.map((field) => ({ ...field, sampleValue: samples[field.key] })),
    providedVariables: event.providedVariables.map((variable) => ({
      ...variable,
      sampleValue: samples[variable.key],
    })),
  };
}

function generateEventFieldSamples(
  event: AutomationEventDefinition,
  language?: SupportedLanguages,
): Record<string, AutomationPlaceholderValue> {
  const fields = Object.fromEntries(
    event.fields.map((field) => [
      field.key,
      generateEmailPreviewTagValue(field.key, field.type, language),
    ]),
  );

  const samples = { ...fields, ...deriveAutomationBranchFieldValues(event.kind, fields) };

  for (const variable of event.providedVariables) {
    if (variable.sourceKey && samples[variable.sourceKey] !== undefined) {
      samples[variable.key] = samples[variable.sourceKey];
    }
  }

  return samples;
}
