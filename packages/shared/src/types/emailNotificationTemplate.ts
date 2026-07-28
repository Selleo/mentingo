import type { LocalizedText } from "./localization";
import type { SupportedLanguages } from "../constants/languages";
import type { EmailTemplateStatus } from "../constants/emailTemplates";

export interface EmailTemplateNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EmailTemplateNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  [key: string]: unknown;
}

export type NodeUuid = string;

export type TranslationFragment = EmailTemplateNode[];

export type EmailTemplateStrings = Partial<
  Record<SupportedLanguages, Record<NodeUuid, TranslationFragment>>
>;

export type EmailTemplateBlocks = EmailTemplateNode;

export type EmailNotificationTemplateRow = {
  id: string;
  name: string;
  subject: LocalizedText;
  status: EmailTemplateStatus;
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
};
