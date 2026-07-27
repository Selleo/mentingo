export const AUTOMATION_PAGE_HANDLES = {
  PAGE: "automation-page",
  HEADING: "automation-page-heading",
  CREATE_BUTTON: "automation-page-create-button",
  SEARCH_INPUT: "automation-page-search-input",
  STATUS_FILTER: "automation-page-status-filter",
  TABLE: "automation-page-table",
  OPEN_LOGS_BUTTON: "automation-page-open-logs-button",
  row: (automationId: string) => `automation-page-row-${automationId}`,
  rowMenuButton: (automationId: string) => `automation-page-row-menu-${automationId}`,
  EMPTY_STATE: "automation-page-empty-state",
  DELETE_DIALOG: "automation-page-delete-dialog",
  DELETE_DIALOG_CANCEL: "automation-page-delete-dialog-cancel",
  DELETE_DIALOG_CONFIRM: "automation-page-delete-dialog-confirm",
} as const;

export const AUTOMATION_DRAWER_HANDLES = {
  ROOT: "automation-drawer",
  NAME_INPUT: "automation-drawer-name-input",
  DESCRIPTION_INPUT: "automation-drawer-description-input",
  STATUS_SELECT: "automation-drawer-status-select",
  OPEN_BUILDER_BUTTON: "automation-drawer-open-builder-button",
  ACTIVATE_BUTTON: "automation-drawer-activate-button",
  PAUSE_BUTTON: "automation-drawer-pause-button",
  ARCHIVE_BUTTON: "automation-drawer-archive-button",
  DELETE_BUTTON: "automation-drawer-delete-button",
} as const;

export const AUTOMATION_BUILDER_HANDLES = {
  PAGE: "automation-builder-page",
  HEADER: "automation-builder-header",
  BACK_BUTTON: "automation-builder-back-button",
  SAVE_BUTTON: "automation-builder-save-button",
  SIMULATE_BUTTON: "automation-builder-simulate-button",
  DELETE_BUTTON: "automation-builder-delete-button",
  TOGGLE_ACTIVE: "automation-builder-toggle-active",
  SIDEBAR: "automation-builder-sidebar",
  CANVAS: "automation-builder-canvas",
  EDIT_PANEL: "automation-builder-edit-panel",
  LEAVE_DIALOG: "automation-builder-leave-dialog",
  LEAVE_DIALOG_SAVE: "automation-builder-leave-dialog-save",
  LEAVE_DIALOG_DISCARD: "automation-builder-leave-dialog-discard",
  canvasNode: (nodeId: string) => `automation-builder-node-${nodeId}`,
} as const;

export const AUTOMATION_LOGS_HANDLES = {
  PAGE: "automation-logs-page",
  TABLE: "automation-logs-table",
  row: (logId: string) => `automation-logs-row-${logId}`,
} as const;
