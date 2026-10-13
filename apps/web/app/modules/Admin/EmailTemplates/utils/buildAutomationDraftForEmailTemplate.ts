import {
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
} from "@repo/shared";

import type { EmailTemplate } from "../emailTemplates.types";
import type { AutomationEventDefinition, CreateAutomationInput } from "@repo/shared";

export function buildAutomationDraftForEmailTemplate(
  template: EmailTemplate & { id: string },
  event: AutomationEventDefinition,
  name: string,
): CreateAutomationInput {
  const triggerId = crypto.randomUUID();

  const mappings = Object.fromEntries(
    (template.placeholders ?? []).flatMap((tag) => {
      const field = event.fields.find((field) => field.key === tag.name && field.type === tag.type);

      if (!field) return [];

      return [[tag.name, { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: field.key }]];
    }),
  );

  const definition: CreateAutomationInput = {
    name,
    description: "",
    workflow: {
      rootStepId: triggerId,
      steps: [
        {
          id: triggerId,
          parentId: null,
          position: 0,
          type: AUTOMATION_STEP_TYPES.TRIGGER,
          config: { eventKind: event.kind },
        },
        {
          id: crypto.randomUUID(),
          parentId: triggerId,
          position: 0,
          type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
          config: {
            template: { type: AUTOMATION_TEMPLATE_TYPES.CUSTOM, id: template.id },
            recipients: { type: AUTOMATION_RECIPIENT_TYPES.EVENT },
            mappings,
          },
        },
      ],
    },
  };

  const action = definition.workflow.steps[1];
  const rules = new Map<string, boolean>();
  for (const tag of template.placeholders ?? []) {
    if (!tag.required) continue;
    const rule = event.fields.find((field) => field.key === tag.name)?.availableWhen;
    if (rule)
      rules.set(
        event.providedVariables.find((variable) => variable.sourceKey === rule.field)?.key ??
          rule.field,
        rule.equals,
      );
  }
  let parentId = triggerId;
  let position = 0;
  for (const [field, value] of rules) {
    const id = crypto.randomUUID();
    definition.workflow.steps.push({
      id,
      parentId,
      position,
      type: AUTOMATION_STEP_TYPES.CONDITION,
      config: { field },
    });
    parentId = id;
    position = value ? 0 : 1;
  }
  action.parentId = parentId;
  action.position = position;
  return definition;
}
