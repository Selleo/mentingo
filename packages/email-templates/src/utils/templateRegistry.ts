import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { snakeCase } from "lodash";

import { EMAIL_SUBJECTS_TRANSLATIONS } from "../email-subjects";
import type { EmailSubjectKey } from "../email-subjects.types";
import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_HEADER_SOURCES,
  EMAIL_TEMPLATE_DOCUMENT_VERSION,
  type CreateEmailTemplateDefinitionInput,
  type EmailTemplateDefinition,
  type EmailTemplateDocument,
  type EmailTemplateVariableDefinition,
  type LocalizedEmailValue,
} from "../template-registry.types";
import type { EmailContent } from "../types";

export const buildLocalizedValuesForSupportedLanguages = <T>(
  factory: (language: SupportedLanguages) => T,
): LocalizedEmailValue<T> => {
  return Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, factory(language)]),
  ) as LocalizedEmailValue<T>;
};

export const buildNormalizedLocalizedSubjectTemplates = (
  subjectKey: EmailSubjectKey,
): LocalizedEmailValue<string> => {
  return buildLocalizedValuesForSupportedLanguages((language) =>
    EMAIL_SUBJECTS_TRANSLATIONS[subjectKey][language].replace(
      /{{\s*([^{}]+?)\s*}}/g,
      (_match, variableName: string) => `{{ ${snakeCase(variableName)} }}`,
    ),
  );
};

export const buildSameLocalizedSubjectTemplates = (subject: string): LocalizedEmailValue<string> =>
  buildLocalizedValuesForSupportedLanguages(() => subject);

export const defineEmailTemplateVariable = (
  key: string,
  label: string,
  type: EmailTemplateVariableDefinition["type"],
  sampleValue: EmailTemplateVariableDefinition["sampleValue"],
  options: Pick<EmailTemplateVariableDefinition, "required" | "requiredInTemplate"> = {},
): EmailTemplateVariableDefinition => ({ key, label, type, sampleValue, ...options });

const createParagraphNode = (text: string) => ({
  type: "paragraph" as const,
  content: text ? [{ type: "text" as const, text }] : undefined,
});

const createDocumentFromEmailContent = (
  content: EmailContent,
  buttonUrl: string,
): EmailTemplateDocument => ({
  type: "doc",
  version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
  content: [
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADER,
      attrs: { source: EMAIL_TEMPLATE_HEADER_SOURCES.TENANT_BRANDING },
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADING,
      content: [createParagraphNode(content.heading)],
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.TEXT,
      content: content.paragraphs.map(createParagraphNode),
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON,
      attrs: { label: content.buttonText, url: buttonUrl },
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER,
      attrs: { text: "Powered by {{ company_name }}" },
    },
  ],
});

export const createEmailTemplateDefinition = ({
  event,
  name,
  description,
  sourceTemplate,
  subject,
  variables,
  getContent,
  buttonUrl,
}: CreateEmailTemplateDefinitionInput): EmailTemplateDefinition => ({
  event,
  name,
  description,
  sourceTemplate,
  defaultLanguage: SUPPORTED_LANGUAGES.EN,
  subjects: subject,
  variables,
  defaultDocuments: buildLocalizedValuesForSupportedLanguages((language) =>
    createDocumentFromEmailContent(getContent(language), buttonUrl),
  ),
});
