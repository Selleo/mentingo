export const TENANTS_PAGE_HANDLES = {
  PAGE: "tenants-page",
  HEADING: "tenants-page-heading",
  CREATE_BUTTON: "tenants-page-create-button",
  SEARCH_INPUT: "tenants-page-search-input",
  STATUS_FILTER: "tenants-page-status-filter",
  statusFilterOption: (status: "all" | "active" | "inactive") =>
    `tenants-page-status-filter-option-${status}`,
  TABLE: "tenants-page-table",
  TABLE_CONTAINER: "tenants-page-table-container",
  TABLE_BODY: "tenants-page-table-body",
  SORT_LAST_ACTIVITY: "tenants-page-sort-last-activity",
  SORT_RECENT_ACTIVITY_COUNT: "tenants-page-sort-recent-activity-count",
  lastActivity: (tenantId: string) => `tenants-page-last-activity-${tenantId}`,
  recentActivitiesPreview: (tenantId: string) =>
    `tenants-page-recent-activities-preview-${tenantId}`,
  activityCount: (tenantId: string) => `tenants-page-activity-count-${tenantId}`,
  activityTrend: (tenantId: string) => `tenants-page-activity-trend-${tenantId}`,
  activeUsers: (tenantId: string) => `tenants-page-active-users-${tenantId}`,
  ROW_PREFIX: "tenants-page-table-row-",
  row: (tenantId: string) => `tenants-page-table-row-${tenantId}`,
  EDIT_BUTTON_PREFIX: "tenants-page-edit-button-",
  editButton: (tenantId: string) => `tenants-page-edit-button-${tenantId}`,
  actionsMenuButton: (tenantId: string) => `tenants-page-actions-menu-button-${tenantId}`,
  DELETE_BUTTON_PREFIX: "tenants-page-delete-button-",
  deleteButton: (tenantId: string) => `tenants-page-delete-button-${tenantId}`,
  DELETE_DIALOG: "tenants-page-delete-dialog",
  DELETE_DIALOG_CANCEL_BUTTON: "tenants-page-delete-dialog-cancel-button",
  DELETE_DIALOG_CONFIRM_BUTTON: "tenants-page-delete-dialog-confirm-button",
  SUPPORT_MODE_BUTTON_PREFIX: "tenants-page-support-mode-button-",
  supportModeButton: (tenantId: string) => `tenants-page-support-mode-button-${tenantId}`,
  SUPPORT_MODE_POPOVER: "tenants-page-support-mode-popover",
  SUPPORT_MODE_SEARCH: "tenants-page-support-mode-search",
  SUPPORT_MODE_ADMINS_TAB: "tenants-page-support-mode-admins-tab",
  SUPPORT_MODE_ALL_USERS_TAB: "tenants-page-support-mode-all-users-tab",
  SUPPORT_MODE_SEARCH_ALL_USERS: "tenants-page-support-mode-search-all-users",
  SUPPORT_MODE_SUBMIT: "tenants-page-support-mode-submit",
  SUPPORT_MODE_USER_OPTION_PREFIX: "tenants-page-support-mode-user-option-",
  supportModeUserOption: (userId: string) => `tenants-page-support-mode-user-option-${userId}`,
  supportModeUserRole: (userId: string, roleSlug: string) =>
    `tenants-page-support-mode-user-role-${userId}-${roleSlug}`,
} as const;

export const TENANT_FORM_HANDLES = {
  NAME_INPUT: "tenant-form-name-input",
  HOST_INPUT: "tenant-form-host-input",
  STATUS_SELECT: "tenant-form-status-select",
  statusOption: (status: "active" | "inactive") => `tenant-form-status-option-${status}`,
  ADMIN_FIRST_NAME_INPUT: "tenant-form-admin-first-name-input",
  ADMIN_LAST_NAME_INPUT: "tenant-form-admin-last-name-input",
  ADMIN_EMAIL_INPUT: "tenant-form-admin-email-input",
  SUBMIT_BUTTON: "tenant-form-submit-button",
} as const;

export const CREATE_TENANT_PAGE_HANDLES = {
  PAGE: "create-tenant-page",
  HEADING: "create-tenant-page-heading",
} as const;

export const TENANT_PAGE_HANDLES = {
  PAGE: "tenant-page",
  HEADING: "tenant-page-heading",
  LOADING: "tenant-page-loading",
} as const;
