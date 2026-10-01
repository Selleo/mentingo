import { EmailTemplateEventData } from "./email-template-event.types";

export class DeleteEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
