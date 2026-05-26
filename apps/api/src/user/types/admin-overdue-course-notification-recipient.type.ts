import type { DefaultEmailSettings } from "src/events/types";

export type AdminOverdueCourseNotificationRecipient = {
  email: string;
  id: string;
  tenantId: string;
  tenantHost: string;
  defaultEmailSettings: DefaultEmailSettings;
};
