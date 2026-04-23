export const TENANTS_PAGE_HANDLES = {
  PAGE: "tenants-page",
  HEADING: "tenants-page-heading",
  CREATE_BUTTON: "tenants-page-create-button",
  SEARCH_INPUT: "tenants-page-search-input",
  TABLE: "tenants-page-table",
  TABLE_BODY: "tenants-page-table-body",
  ROW_PREFIX: "tenants-page-table-row-",
  row: (tenantId: string) => `tenants-page-table-row-${tenantId}`,
  EDIT_BUTTON_PREFIX: "tenants-page-edit-button-",
  editButton: (tenantId: string) => `tenants-page-edit-button-${tenantId}`,
  SUPPORT_MODE_BUTTON_PREFIX: "tenants-page-support-mode-button-",
  supportModeButton: (tenantId: string) => `tenants-page-support-mode-button-${tenantId}`,
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
