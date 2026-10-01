import { EmailTemplateEventData } from "./email-template-event.types";

export class AddEmailTemplateLanguageEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
