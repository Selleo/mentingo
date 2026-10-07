import type { DefaultEmailSettings } from "src/events/types";

export type AdminOverdueCourseNotificationRecipient = {
  email: string;
  firstName: string;
  lastName: string;
  id: string;
  tenantId: string;
  tenantHost: string;
  defaultEmailSettings: DefaultEmailSettings;
};
