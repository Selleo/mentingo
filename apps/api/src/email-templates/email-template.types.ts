import type { PreviewEmailTemplateBody } from "./schemas/email-template.schema";
import type { EmailTemplateEvent, EmailTemplateVariableValue } from "@repo/email-templates";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type EmailTemplateTestJobData = {
  tenantId: UUIDType;
  userId: UUIDType;
  recipient: string;
  body: PreviewEmailTemplateBody;
};

export type EmailTemplateDeliveryContext = {
  event: EmailTemplateEvent;
  language: SupportedLanguages;
  variables: Record<string, EmailTemplateVariableValue>;
};

export type EmailTemplateSendOptions = {
  tenantId: UUIDType;
  template?: EmailTemplateDeliveryContext;
};
