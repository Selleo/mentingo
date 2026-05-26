export const NOTIFICATIONS_HANDLES = {
  TRIGGER: "notifications-trigger",
  MOBILE_TRIGGER: "notifications-mobile-trigger",
  PAGE: "notifications-page",
  POPOVER: "notifications-popover",
  REFRESH_BUTTON: "notifications-refresh-button",
  CREATE_BUTTON: "notifications-create-button",
  CENTER_LINK: "notifications-center-link",
  MARK_ALL_READ_BUTTON: "notifications-mark-all-read-button",
  EMPTY_STATE: "notifications-empty-state",
  card: (announcementId: string) => `notification-announcement-card-${announcementId}`,
  deleteButton: (announcementId: string) => `notification-announcement-delete-${announcementId}`,
  markReadButton: (announcementId: string) => `notification-announcement-read-${announcementId}`,
} as const;
