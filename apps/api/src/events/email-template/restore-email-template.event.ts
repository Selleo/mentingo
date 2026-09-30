import { EmailTemplateEventData } from "./email-template-event.types";

export class RestoreEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
