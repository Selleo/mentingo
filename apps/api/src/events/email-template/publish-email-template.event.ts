import { EmailTemplateEventData } from "./email-template-event.types";

export class PublishEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
