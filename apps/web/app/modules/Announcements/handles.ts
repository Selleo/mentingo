export const ANNOUNCEMENTS_PAGE_HANDLES = {
  PAGE: "announcements-page",
  HEADING: "announcements-page-heading",
  CREATE_BUTTON: "announcements-page-create-button",
  LIST: "announcements-page-list",
  EMPTY_STATE: "announcements-page-empty-state",
} as const;

export const CREATE_ANNOUNCEMENT_PAGE_HANDLES = {
  PAGE: "create-announcement-page",
  HEADING: "create-announcement-page-heading",
  TITLE_INPUT: "create-announcement-title-input",
  GROUP_SELECT: "create-announcement-group-select",
  CONTENT_INPUT: "create-announcement-content-input",
  SUBMIT_BUTTON: "create-announcement-submit-button",
  CANCEL_BUTTON: "create-announcement-cancel-button",
} as const;

export const ANNOUNCEMENT_CARD_HANDLES = {
  CARD_PREFIX: "announcement-card-",
  card: (announcementId: string) => `announcement-card-${announcementId}`,
  MARK_AS_READ_BUTTON_PREFIX: "announcement-card-mark-as-read-button-",
  markAsReadButton: (announcementId: string) =>
    `announcement-card-mark-as-read-button-${announcementId}`,
} as const;

export const LATEST_ANNOUNCEMENTS_POPUP_HANDLES = {
  ROOT: "latest-announcements-popup",
  CARD_PREFIX: "latest-announcement-card-",
  card: (announcementId: string) => `latest-announcement-card-${announcementId}`,
  MARK_AS_READ_BUTTON_PREFIX: "latest-announcement-mark-as-read-button-",
  markAsReadButton: (announcementId: string) =>
    `latest-announcement-mark-as-read-button-${announcementId}`,
  READ_MORE_BUTTON_PREFIX: "latest-announcement-read-more-button-",
  readMoreButton: (announcementId: string) =>
    `latest-announcement-read-more-button-${announcementId}`,
} as const;
