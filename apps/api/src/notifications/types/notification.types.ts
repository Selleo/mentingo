import type {
  AutomationEventKind,
  AutomationPlaceholderValue,
  AutomationRecipientAudience,
  SupportedLanguages,
} from "@repo/shared";
import type {
  NotificationEventItem,
  NotificationRecipient,
} from "src/automation-execution/automation-execution.types";

export type NotificationRecipientsByEvent = Map<AutomationEventKind, NotificationRecipient[]>;
export type NotificationItemsByEvent = Map<AutomationEventKind, NotificationEventItem[]>;

export type NotificationCaptureOptions = {
  audience?: AutomationRecipientAudience;
  tenantId: string;
  template?: {
    event: AutomationEventKind;
    language: SupportedLanguages;
    variables: Readonly<Record<string, AutomationPlaceholderValue>>;
  };
};
