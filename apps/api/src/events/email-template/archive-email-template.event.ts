import { EmailTemplateEventData } from "./email-template-event.types";

export class ArchiveEmailTemplateEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
