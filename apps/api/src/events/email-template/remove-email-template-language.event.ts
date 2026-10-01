import { EmailTemplateEventData } from "./email-template-event.types";

export class RemoveEmailTemplateLanguageEvent {
  constructor(public readonly data: EmailTemplateEventData) {}
}
