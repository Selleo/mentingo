import { EmailTemplateEventData } from "./email-template-event.types";

export class CreateEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
