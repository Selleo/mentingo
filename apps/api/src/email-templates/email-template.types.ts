import type { PreviewEmailTemplateBody } from "./schemas/email-template.schema";
import type { EmailTemplateEvent, PublishedEmailTemplate } from "@repo/email-templates";
import type { AutomationTemplateReference } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { emailTemplates } from "src/storage/schema";

export type EmailTemplateRecord = typeof emailTemplates.$inferSelect;

export type EmailTemplateCatalogEntry = PublishedEmailTemplate & {
  reference: AutomationTemplateReference;
};

export type EmailTemplateActivityLogSnapshot = {
  id: UUIDType;
  event: EmailTemplateEvent | null;
  name?: string;
  status?: string;
  baseLanguage?: string;
  availableLocales?: string[];
  [localizedField: string]: unknown;
};
export type EmailTemplateTranslationUpdate = Pick<
  Partial<typeof emailTemplates.$inferInsert>,
  | "name"
  | "subject"
  | "content"
  | "availableLocales"
  | "updatedAt"
  | "placeholders"
  | "triggerEventKind"
>;

export type EmailTemplateTestJobData = {
  tenantId: UUIDType;
  userId: UUIDType;
  recipient: string;
  body: PreviewEmailTemplateBody;
};

export const EMAIL_TEMPLATE_DEPENDENCIES = Symbol("EMAIL_TEMPLATE_DEPENDENCIES");
export interface EmailTemplateDependencies {
  removeUnusedEmailTagMappingsFromAutomations(
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
    published: boolean,
    transaction: DatabasePg,
  ): Promise<void>;
  assertEmailTemplateCanBeArchived(templateId: UUIDType, transaction: DatabasePg): Promise<void>;
  validateEmailTemplatePublicationDependencies(
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
    transaction: DatabasePg,
  ): Promise<void>;
  cancelPendingEmailTemplateDeliveries(
    templateId: UUIDType,
    transaction: DatabasePg,
  ): Promise<void>;
}

export type MappedTemplateRenderOptions = {
  preview?: boolean;
  sensitivePlaceholderKeys?: readonly string[];
};
