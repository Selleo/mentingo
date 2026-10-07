import type {
  AutomationPlaceholderDefinition,
  LocalizedText,
  SupportedLanguages,
  BuiltInEmailTemplateKey,
} from "@repo/shared";

import type { EmailSubjectKey } from "./email-subjects.types";
import type { EmailContent } from "./types";
import type { LocalizedEmailTemplateContent, EmailTemplateEvent } from "./template-registry.types";

export type PublishedEmailTemplate = {
  name: LocalizedText;
  subject: LocalizedText;
  content: LocalizedEmailTemplateContent;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  placeholders: AutomationPlaceholderDefinition[];
};

export type EmailTemplateVariant = {
  key: BuiltInEmailTemplateKey;
  event: EmailTemplateEvent;
  suffix: Record<SupportedLanguages, string>;
  button: string;
  subject?: EmailSubjectKey;
  content: (language: SupportedLanguages) => EmailContent;
};
