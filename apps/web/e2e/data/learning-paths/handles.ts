export const LEARNING_PATHS_PAGE_HANDLES = {
  PAGE: "learning-paths-page",
  ADMIN_PAGE: "admin-learning-paths-page",
  ADMIN_EDITOR_PAGE: "admin-learning-path-editor-page",
  HEADING: "learning-paths-heading",
  SEARCH_INPUT: "learning-paths-search-input",
};

export const ADMIN_LEARNING_PATHS_HANDLES = {
  CREATE_BUTTON: "admin-learning-paths-create-button",
  CREATE_TITLE_INPUT: "admin-learning-paths-create-title-input",
  CREATE_DESCRIPTION_INPUT: "admin-learning-paths-create-description-input",
  CREATE_CANCEL_BUTTON: "admin-learning-paths-create-cancel-button",
  CREATE_SUBMIT_BUTTON: "admin-learning-paths-create-submit-button",
} as const;

export const LEARNING_PATH_CARD_HANDLES = {
  card: (learningPathId: string) => `learning-path-card-${learningPathId}`,
  TITLE_EDIT_TRIGGER: "learning-path-card-title-edit-trigger",
  TITLE_EDIT_INPUT: "learning-path-card-title-edit-input",
  DESCRIPTION_EDIT_TRIGGER: "learning-path-card-description-edit-trigger",
  DESCRIPTION_EDIT_INPUT: "learning-path-card-description-edit-input",
  DELETE_TRIGGER: "learning-path-card-delete-trigger",
  DELETE_CONFIRM_BUTTON: "learning-path-card-delete-confirm-button",
  DELETE_CANCEL_BUTTON: "learning-path-card-delete-cancel-button",
  SETTINGS_TRIGGER: "learning-path-card-settings-trigger",
  ENROLLMENT_TRIGGER: "learning-path-card-enrollment-trigger",
  SELF_ENROLL_BUTTON: "learning-path-card-self-enroll-button",
  ENROLLED_BADGE: "learning-path-card-enrolled-badge",
  ADD_COURSES_TRIGGER: "learning-path-card-add-courses-trigger",
  ADD_COURSES_SELECT: "learning-path-card-add-courses-select",
  addCoursesOption: (courseId: string) => `learning-path-card-add-courses-option-${courseId}`,
  ADD_COURSES_CONFIRM_BUTTON: "learning-path-card-add-courses-confirm-button",
  ADD_COURSES_CANCEL_BUTTON: "learning-path-card-add-courses-cancel-button",
  removeCourseButton: (courseId: string) => `learning-path-card-remove-course-button-${courseId}`,
  courseRow: (courseId: string) => `learning-path-card-course-row-${courseId}`,
  courseDragHandle: (courseId: string) => `learning-path-card-course-drag-handle-${courseId}`,
} as const;

export const LEARNING_PATH_SETTINGS_DRAWER_HANDLES = {
  DRAWER: "learning-path-settings-drawer",
  STATUS_SELECT: "learning-path-settings-status-select",
  statusOption: (status: string) => `learning-path-settings-status-option-${status}`,
  SEQUENCE_SWITCH: "learning-path-settings-sequence-switch",
  CERTIFICATE_SWITCH: "learning-path-settings-certificate-switch",
  CERTIFICATE_PREVIEW_BUTTON: "learning-path-settings-certificate-preview-button",
  CLOSE_BUTTON: "learning-path-settings-close-button",
} as const;

export const LEARNING_PATH_CERTIFICATE_HANDLES = {
  BANNER: "learning-path-certificate-banner",
  VIEW_BUTTON: "learning-path-certificate-view-button",
} as const;

export const LEARNING_PATH_ENROLLED_HANDLES = {
  DRAWER: "learning-path-enrolled-drawer",
  SEARCH_INPUT: "learning-path-enrolled-search-input",
  GROUPS_FILTER: "learning-path-enrolled-groups-filter",
  groupFilterOption: (groupId: string) => `learning-path-enrolled-groups-filter-option-${groupId}`,
  row: (userId: string) => `learning-path-enrolled-row-${userId}`,
  rowCheckbox: (userId: string) => `learning-path-enrolled-row-checkbox-${userId}`,
  statusBadge: (userId: string) => `learning-path-enrolled-status-badge-${userId}`,
  SELECT_ALL_CHECKBOX: "learning-path-enrolled-select-all-checkbox",
  USER_ACTIONS_TRIGGER: "learning-path-enrolled-user-actions-trigger",
  USER_ENROLL_SELECTED_ACTION: "learning-path-enrolled-user-enroll-selected-action",
  USER_UNENROLL_SELECTED_ACTION: "learning-path-enrolled-user-unenroll-selected-action",
  ENROLL_USERS_DIALOG: "learning-path-enrolled-enroll-users-dialog",
  ENROLL_USERS_CONFIRM_BUTTON: "learning-path-enrolled-enroll-users-confirm-button",
  UNENROLL_USERS_DIALOG: "learning-path-enrolled-unenroll-users-dialog",
  UNENROLL_USERS_CONFIRM_BUTTON: "learning-path-enrolled-unenroll-users-confirm-button",
  GROUP_ACTIONS_TRIGGER: "learning-path-enrolled-group-actions-trigger",
  GROUP_ENROLL_ACTION: "learning-path-enrolled-group-enroll-action",
  GROUP_UNENROLL_ACTION: "learning-path-enrolled-group-unenroll-action",
  GROUP_ACTION_DIALOG: "learning-path-enrolled-group-action-dialog",
  GROUP_ACTION_SELECT: "learning-path-enrolled-group-action-select",
  groupActionOption: (groupId: string) => `learning-path-enrolled-group-action-option-${groupId}`,
  GROUP_ACTION_CONFIRM_BUTTON: "learning-path-enrolled-group-action-confirm-button",
} as const;
