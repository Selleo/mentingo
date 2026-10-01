import { EmailTemplateEventData } from "./email-template-event.types";

export class UpdateEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
