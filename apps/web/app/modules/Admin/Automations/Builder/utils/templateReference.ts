import { AUTOMATION_TEMPLATE_TYPES } from "@repo/shared";

import type { AutomationTemplateReference } from "@repo/shared";

export function serializeAutomationTemplateReference(reference: AutomationTemplateReference) {
  if (reference.type === AUTOMATION_TEMPLATE_TYPES.BUILTIN) return `builtin:${reference.key}`;

  return `custom:${reference.id}`;
}
