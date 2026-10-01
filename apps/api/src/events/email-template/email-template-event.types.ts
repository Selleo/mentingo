import type { ActorUserType } from "src/common/types/actor-user.type";
import type { EmailTemplateActivityLogSnapshot } from "src/email-templates/email-template.types";

export type EmailTemplateEventData = {
  actor: ActorUserType;
  resource: EmailTemplateActivityLogSnapshot;
  previous?: EmailTemplateActivityLogSnapshot;
  changedFields?: string[];
  context?: Record<string, string>;
};
