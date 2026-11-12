export const AUTOMATIONS_TABLE_FILTER_PARAMS = {
  STATUS: "status",
} as const;

export const AUTOMATIONS_TABLE_FILTER_KEYS = [AUTOMATIONS_TABLE_FILTER_PARAMS.STATUS] as const;

export const AUTOMATIONS_TABLE_ANY_STATUS = "__all__";

export const AUTOMATIONS_TABLE_DEFAULT_PAGE_SIZE = 10;

export const AUTOMATIONS_PAGE_HANDLES = {
  CREATE_BUTTON: "automation-page-create-button",
  SEARCH_INPUT: "automation-page-search-input",
  STATUS_FILTER: "automation-page-status-filter",
  statusFilterOption: (status: string) => `automation-page-status-filter-option-${status}`,
  TABLE: "automation-page-table",
  row: (automationId: string) => `automation-page-row-${automationId}`,
  EMPTY_STATE: "automation-page-empty-state",
} as const;

export const AUTOMATION_LOGS_PAGE_HANDLES = {
  SEARCH_INPUT: "automation-logs-page-search-input",
  STATUS_FILTER: "automation-logs-page-status-filter",
  statusFilterOption: (status: string) => `automation-logs-page-status-filter-option-${status}`,
  TABLE: "automation-logs-page-table",
  row: (automationRunId: string) => `automation-logs-page-row-${automationRunId}`,
  EMPTY_STATE: "automation-logs-page-empty-state",
} as const;
