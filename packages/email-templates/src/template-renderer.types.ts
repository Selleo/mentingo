import type { SupportedLanguages } from "@repo/shared";

import type { EmailTemplateDocument, EmailTemplateVariableValue } from "./template-registry.types";

export type EmailTemplateBranding = {
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
  borderCircleUrl?: string;
};

export type RenderEmailTemplateInput = {
  document: EmailTemplateDocument;
  subject: string;
  variables: Readonly<Record<string, EmailTemplateVariableValue>>;
  branding: EmailTemplateBranding;
  language?: SupportedLanguages;
};

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};
