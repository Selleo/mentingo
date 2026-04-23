export const COURSE_TAB_VALUES = {
  SETTINGS: "Settings",
  CURRICULUM: "Curriculum",
  PRICING: "Pricing",
  STATUS: "Status",
  ENROLLED: "Enrolled",
  EXPORTS: "Exports",
} as const;

export type CourseTabValue = (typeof COURSE_TAB_VALUES)[keyof typeof COURSE_TAB_VALUES];

export const COURSES_PAGE_HANDLES = {
  PAGE: "courses-page",
  HEADING: "courses-page-heading",
  CREATE_BUTTON: "courses-page-create-button",
  TITLE_FILTER: "courses-page-title-filter",
  CATEGORY_FILTER: "courses-page-category-filter",
  categoryFilterOption: (categoryTitle: string) => `courses-page-category-option-${categoryTitle}`,
  STATE_FILTER: "courses-page-state-filter",
  stateFilterOption: (state: "all" | "draft" | "published" | "private") =>
    `courses-page-state-option-${state}`,
  ARCHIVED_FILTER: "courses-page-archived-filter",
  archivedFilterOption: (status: "all" | "active" | "archived") =>
    `courses-page-archived-option-${status}`,
  DELETE_SELECTED_BUTTON: "courses-page-delete-selected-button",
  DELETE_DIALOG: "courses-page-delete-dialog",
  DELETE_DIALOG_CANCEL_BUTTON: "courses-page-delete-dialog-cancel-button",
  DELETE_DIALOG_CONFIRM_BUTTON: "courses-page-delete-dialog-confirm-button",
  TABLE: "courses-page-table",
  TABLE_BODY: "courses-page-table-body",
  row: (courseId: string) => `courses-page-table-row-${courseId}`,
  rowCheckbox: (courseId: string) => `courses-page-table-checkbox-${courseId}`,
} as const;

export const CREATE_COURSE_PAGE_HANDLES = {
  PAGE: "create-course-page",
  HEADING: "create-course-page-heading",
  TITLE_INPUT: "create-course-title-input",
  CATEGORY_SELECT: "create-course-category-select",
  categoryOption: (categoryTitle: string) => `create-course-category-option-${categoryTitle}`,
  LANGUAGE_SELECT: "create-course-language-select",
  languageOption: (language: "en" | "pl" | "de" | "lt" | "cs") =>
    `create-course-language-option-${language}`,
  DESCRIPTION_EDITOR: "create-course-description-editor",
  CANCEL_BUTTON: "create-course-cancel-button",
  SUBMIT_BUTTON: "create-course-submit-button",
} as const;

export const EDIT_COURSE_PAGE_HANDLES = {
  PAGE: "edit-course-page",
  HEADING: "edit-course-page-heading",
  PREVIEW_BUTTON: "edit-course-preview-button",
  LANGUAGE_SELECT: "edit-course-language-select",
  languageOption: (language: "en" | "pl" | "de" | "lt" | "cs") =>
    `edit-course-language-option-${language}`,
  DELETE_LANGUAGE_BUTTON: "edit-course-delete-language-button",
  tab: (tab: CourseTabValue) => `edit-course-tab-${tab}`,
} as const;

export const COURSE_SETTINGS_HANDLES = {
  TITLE_INPUT: "course-settings-title-input",
  CATEGORY_SELECT: "course-settings-category-select",
  categoryOption: (categoryTitle: string) => `course-settings-category-option-${categoryTitle}`,
  DESCRIPTION_EDITOR: "course-settings-description-editor",
  SAVE_BUTTON: "course-settings-save-button",
  LESSON_SEQUENCE_SWITCH: "course-settings-lesson-sequence-switch",
  QUIZ_FEEDBACK_SWITCH: "course-settings-quiz-feedback-switch",
  CERTIFICATE_SWITCH: "course-settings-certificate-switch",
} as const;

export const COURSE_STATUS_HANDLES = {
  CARD: "course-status-card",
  statusCard: (status: "draft" | "private" | "published") => `course-status-card-${status}`,
  SAVE_BUTTON: "course-status-save-button",
} as const;

export const COURSE_PRICING_HANDLES = {
  FREE_CARD: "course-pricing-free-card",
  PAID_CARD: "course-pricing-paid-card",
  PRICE_INPUT: "course-pricing-price-input",
  SAVE_BUTTON: "course-pricing-save-button",
} as const;

export const COURSE_LANGUAGE_DIALOG_HANDLES = {
  CREATE_DIALOG: "course-language-create-dialog",
  CREATE_CANCEL_BUTTON: "course-language-create-cancel-button",
  CREATE_CONFIRM_BUTTON: "course-language-create-confirm-button",
  DELETE_DIALOG: "course-language-delete-dialog",
  DELETE_CANCEL_BUTTON: "course-language-delete-cancel-button",
  DELETE_CONFIRM_BUTTON: "course-language-delete-confirm-button",
  GENERATE_DIALOG: "course-language-generate-dialog",
  GENERATE_BUTTON: "course-language-generate-button",
  GENERATE_CANCEL_BUTTON: "course-language-generate-cancel-button",
  GENERATE_CONFIRM_BUTTON: "course-language-generate-confirm-button",
} as const;

export const COURSE_OVERVIEW_HANDLES = {
  STUDENT_MODE_BUTTON: "course-overview-student-mode-button",
  AUTHOR_TRANSFER_BUTTON: "course-overview-author-transfer-button",
  TRANSFER_OWNERSHIP_SELECT: "course-transfer-ownership-select",
  transferOwnershipOption: (userId: string) => `course-transfer-ownership-option-${userId}`,
} as const;
