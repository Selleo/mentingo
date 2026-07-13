export const ACTIVITY_LOGS_HANDLES = {
  PAGE: "activity-logs-page",
  SEARCH_INPUT: "activity-logs-search-input",
  RESOURCE_FILTER: "activity-logs-resource-filter",
  resourceFilterOption: (resourceType: string) =>
    `activity-logs-resource-filter-option-${resourceType}`,
  ACTION_FILTER: "activity-logs-action-filter",
  actionFilterOption: (actionType: string) => `activity-logs-action-filter-option-${actionType}`,
  FROM_DATE_FILTER: "activity-logs-from-date-filter",
  TO_DATE_FILTER: "activity-logs-to-date-filter",
  row: (logId: string) => `activity-logs-row-${logId}`,
} as const;
