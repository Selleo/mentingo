import type { EMAIL_TEMPLATE_ACTIONS } from "./emailTemplates.constants";
import type {
  GetEmailTemplateResponse,
  UpdateEmailTemplateBody,
  UpdateBaseLanguageBody,
} from "~/api/generated-api";

export type UpdateEmailTemplateVariables = { id: string; body: UpdateEmailTemplateBody };
export type UpdateEmailTemplateBaseLanguageVariables = { id: string; body: UpdateBaseLanguageBody };

export type EmailTemplate = GetEmailTemplateResponse["data"];
export type EmailTemplateEvent = EmailTemplate["event"];
export type EmailTemplateDocument = NonNullable<EmailTemplate["content"]["en"]>;
export type EmailTemplateBlock = EmailTemplateDocument["content"][number];
export type EmailTemplateParagraph = Extract<
  EmailTemplateBlock,
  { type: "text" }
>["content"][number];
export type EmailTemplateVariables = EmailTemplate["variables"];
export type EmailTemplateFormValues = Pick<EmailTemplate, "name" | "subject" | "content">;

export type EmailTemplateConfirmationAction =
  | (typeof EMAIL_TEMPLATE_ACTIONS)[keyof typeof EMAIL_TEMPLATE_ACTIONS]
  | null;
export type EmailTemplateBlockMoveDirection = -1 | 1;
export type EmailTemplateVariableInserter = ((token: string) => void) | null;

export type EmailTemplateListConfirmation = {
  templateId: string;
  action: Exclude<EmailTemplateConfirmationAction, null>;
};
