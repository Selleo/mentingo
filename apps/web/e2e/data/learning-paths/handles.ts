export const LEARNING_PATHS_PAGE_HANDLES = {
  PAGE: "learning-paths-page",
  ADMIN_PAGE: "admin-learning-paths-page",
  ADMIN_EDITOR_PAGE: "admin-learning-path-editor-page",
  HEADING: "learning-paths-heading",
  SEARCH_INPUT: "learning-paths-search-input",
  CREATE_BUTTON: "learning-paths-create-button",
  CREATE_TILE: "learning-paths-create-tile",
  NEXT_PAGE_LOADER: "learning-paths-next-page-loader",
} as const;

export const LEARNING_PATH_CREATE_DIALOG_HANDLES = {
  DIALOG: "learning-path-create-dialog",
  TITLE_INPUT: "learning-path-create-title-input",
  DESCRIPTION_INPUT: "learning-path-create-description-input",
  SUBMIT_BUTTON: "learning-path-create-submit-button",
  CANCEL_BUTTON: "learning-path-create-cancel-button",
} as const;

export const LEARNING_PATH_CARD_HANDLES = {
  CARD_PREFIX: "learning-path-item-",
  card: (learningPathId: string) => `learning-path-item-${learningPathId}`,
  TITLE: "learning-path-card-title",
  DESCRIPTION: "learning-path-card-description",
  DESCRIPTION_INPUT: "learning-path-card-description-input",
  CONTINUE_BUTTON: "learning-path-card-continue-button",
  PROGRESS_BAR: "learning-path-card-progress-bar",
  ENROLL_BUTTON: "learning-path-card-enroll-button",
  SETTINGS_BUTTON: "learning-path-card-settings-button",
} as const;

export const LEARNING_PATH_SETTINGS_TABS = {
  GENERAL: "general",
  CERTIFICATE: "certificate",
  EXPORT: "export",
} as const;

export const LEARNING_PATH_SETTINGS_TAB_PARAM = "settingsTab";

export const LEARNING_PATH_SETTINGS_HANDLES = {
  DRAWER: "learning-path-settings-drawer",
  tab: (tab: string) => `learning-path-settings-tab-${tab}`,
} as const;

export const LEARNING_PATH_TRAIL_STOP_STATUSES = {
  COMPLETED: "completed",
  IN_PROGRESS: "inProgress",
  NOT_STARTED: "notStarted",
  LOCKED: "locked",
  NEUTRAL: "neutral",
} as const;

export const LEARNING_PATH_TRAIL_HANDLES = {
  TRAIL: "learning-path-trail",
  STOP_PREFIX: "learning-path-trail-stop-",
  stop: (courseId: string) => `learning-path-trail-stop-${courseId}`,
  removeButton: (courseId: string) => `learning-path-trail-remove-${courseId}`,
  dragHandle: (courseId: string) => `learning-path-trail-drag-${courseId}`,
  ADD_COURSE_BUTTON: "learning-path-trail-add-course-button",
  COURSE_PREVIEW: "learning-path-trail-course-preview",
  COURSE_PREVIEW_OPEN_LINK: "learning-path-trail-course-preview-open-link",
} as const;

export const LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES = {
  DIALOG: "learning-path-add-courses-dialog",
  SEARCH_INPUT: "learning-path-add-courses-search-input",
  option: (courseId: string) => `learning-path-add-courses-option-${courseId}`,
  SUBMIT_BUTTON: "learning-path-add-courses-submit-button",
} as const;
