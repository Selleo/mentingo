import type {
  AutomationPlaceholderDefinition,
  AutomationTemplateReference,
  SupportedLanguages,
  UpdateAutomationInput,
} from "@repo/shared";
/** Authoritative placeholder metadata used by the automation template selector. */
export type AutomationTemplateOption = {
  reference: AutomationTemplateReference;
  name: string;
  baseLanguage: SupportedLanguages;
  placeholders: AutomationPlaceholderDefinition[];
};

export type UpdateAutomationMutationInput = { id: string; data: UpdateAutomationInput };
