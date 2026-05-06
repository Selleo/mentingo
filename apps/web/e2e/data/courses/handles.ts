import type { CourseEnrollment, CourseStatus, SupportedLanguages } from "@repo/shared";

export const COURSE_TAB_VALUES = {
  SETTINGS: "Settings",
  CURRICULUM: "Curriculum",
  PRICING: "Pricing",
  STATUS: "Status",
  ENROLLED: "Enrolled",
  EXPORTS: "Exports",
} as const;

export type CourseTabValue = (typeof COURSE_TAB_VALUES)[keyof typeof COURSE_TAB_VALUES];
export type CourseStatusFilterValue = CourseStatus | "all";

export const COURSES_PAGE_HANDLES = {
  PAGE: "courses-page",
  HEADING: "courses-page-heading",
  CREATE_BUTTON: "courses-page-create-button",
  TITLE_FILTER: "courses-page-title-filter",
  CATEGORY_FILTER: "courses-page-category-filter",
  categoryFilterOption: (categoryTitle: string) => `courses-page-category-option-${categoryTitle}`,
  STATE_FILTER: "courses-page-state-filter",
  stateFilterOption: (state: CourseStatusFilterValue) => `courses-page-state-option-${state}`,
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
  rowTypeBadge: (courseId: string) => `courses-page-table-type-badge-${courseId}`,
} as const;

export const CREATE_COURSE_PAGE_HANDLES = {
  PAGE: "create-course-page",
  HEADING: "create-course-page-heading",
  TITLE_INPUT: "create-course-title-input",
  CATEGORY_SELECT: "create-course-category-select",
  categoryOption: (categoryTitle: string) => `create-course-category-option-${categoryTitle}`,
  LANGUAGE_SELECT: "create-course-language-select",
  languageOption: (language: SupportedLanguages) => `create-course-language-option-${language}`,
  DESCRIPTION_EDITOR: "create-course-description-editor",
  CANCEL_BUTTON: "create-course-cancel-button",
  SUBMIT_BUTTON: "create-course-submit-button",
} as const;

export const CREATE_SCORM_COURSE_PAGE_HANDLES = {
  PAGE: "create-scorm-course-page",
  HEADING: "create-scorm-course-page-heading",
  PACKAGE_UPLOAD: "create-scorm-course-package-upload",
  PACKAGE_INPUT: "create-scorm-course-package-input",
  PACKAGE_SELECTED_FILE: "create-scorm-course-package-selected-file",
  PACKAGE_REMOVE_BUTTON: "create-scorm-course-package-remove-button",
  PACKAGE_REPLACE_BUTTON: "create-scorm-course-package-replace-button",
  TITLE_INPUT: "create-scorm-course-title-input",
  CATEGORY_SELECT: "create-scorm-course-category-select",
  categoryOption: (categoryTitle: string) => `create-scorm-course-category-option-${categoryTitle}`,
  LANGUAGE_SELECT: "create-scorm-course-language-select",
  languageOption: (language: SupportedLanguages) =>
    `create-scorm-course-language-option-${language}`,
  DESCRIPTION_EDITOR: "create-scorm-course-description-editor",
  THUMBNAIL_INPUT: "create-scorm-course-thumbnail-input",
  CANCEL_BUTTON: "create-scorm-course-cancel-button",
  SUBMIT_BUTTON: "create-scorm-course-submit-button",
} as const;

export const COURSE_TYPE_SELECTOR_HANDLES = {
  PAGE: "course-type-selector-page",
  STANDARD_CARD: "course-type-selector-standard-card",
  SCORM_CARD: "course-type-selector-scorm-card",
  BACK_BUTTON: "course-type-selector-back-button",
} as const;

export const EDIT_COURSE_PAGE_HANDLES = {
  PAGE: "edit-course-page",
  HEADING: "edit-course-page-heading",
  PREVIEW_BUTTON: "edit-course-preview-button",
  COURSE_TYPE_BADGE: "edit-course-type-badge",
  LANGUAGE_SELECT: "edit-course-language-select",
  languageOption: (language: SupportedLanguages) => `edit-course-language-option-${language}`,
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
  statusCard: (status: CourseStatus) => `course-status-card-${status}`,
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
  ENROLL_BUTTON: "course-overview-enroll-button",
  LOGIN_ENROLL_LINK: "course-overview-login-enroll-link",
  START_LEARNING_BUTTON: "course-overview-start-learning-button",
} as const;

export const COURSE_ENROLLED_HANDLES = {
  ROOT: "course-enrolled-root",
  SEARCH_INPUT: "course-enrolled-search-input",
  GROUPS_FILTER: "course-enrolled-groups-filter",
  groupFilterOption: (groupId: string) => `course-enrolled-groups-filter-option-${groupId}`,
  USER_ACTIONS_TRIGGER: "course-enrolled-user-actions-trigger",
  USER_ENROLL_SELECTED_ACTION: "course-enrolled-user-enroll-selected-action",
  USER_UNENROLL_SELECTED_ACTION: "course-enrolled-user-unenroll-selected-action",
  GROUP_ACTIONS_TRIGGER: "course-enrolled-group-actions-trigger",
  GROUP_ENROLL_ACTION: "course-enrolled-group-enroll-action",
  GROUP_UNENROLL_ACTION: "course-enrolled-group-unenroll-action",
  TABLE: "course-enrolled-table",
  row: (userId: string) => `course-enrolled-row-${userId}`,
  rowCheckbox: (userId: string) => `course-enrolled-row-checkbox-${userId}`,
  statusBadge: (userId: string, status: CourseEnrollment) =>
    `course-enrolled-status-${userId}-${status}`,
  sortButton: (field: "firstName" | "lastName" | "email" | "isEnrolledByGroup" | "enrolledAt") =>
    `course-enrolled-sort-${field}`,
  USER_ENROLL_DIALOG: "course-enrolled-user-enroll-dialog",
  USER_ENROLL_CONFIRM_BUTTON: "course-enrolled-user-enroll-confirm-button",
  USER_UNENROLL_DIALOG: "course-enrolled-user-unenroll-dialog",
  USER_UNENROLL_CONFIRM_BUTTON: "course-enrolled-user-unenroll-confirm-button",
  GROUP_ENROLL_DIALOG: "course-enrolled-group-enroll-dialog",
  GROUP_ENROLL_SUBMIT_BUTTON: "course-enrolled-group-enroll-submit-button",
  groupEnrollItem: (groupId: string) => `course-enrolled-group-enroll-item-${groupId}`,
  groupEnrollCheckbox: (groupId: string) => `course-enrolled-group-enroll-checkbox-${groupId}`,
  groupMandatorySwitch: (groupId: string) => `course-enrolled-group-mandatory-switch-${groupId}`,
  groupDeadlineButton: (groupId: string) => `course-enrolled-group-deadline-button-${groupId}`,
  GROUP_UNENROLL_DIALOG: "course-enrolled-group-unenroll-dialog",
  GROUP_UNENROLL_SUBMIT_BUTTON: "course-enrolled-group-unenroll-submit-button",
  groupUnenrollItem: (groupId: string) => `course-enrolled-group-unenroll-item-${groupId}`,
  groupUnenrollCheckbox: (groupId: string) => `course-enrolled-group-unenroll-checkbox-${groupId}`,
} as const;
