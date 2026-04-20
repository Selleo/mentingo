export const CATEGORIES_PAGE_HANDLES = {
  PAGE: "categories-page",
  HEADING: "categories-page-heading",
  CREATE_BUTTON: "categories-page-create-button",
  SEARCH_INPUT: "categories-page-search-input",
  STATUS_FILTER: "categories-page-status-filter",
  statusFilterOption: (status: "all" | "active" | "archived") =>
    `categories-page-status-filter-option-${status}`,
  SELECT_ALL_CHECKBOX: "categories-page-select-all-checkbox",
  TABLE: "categories-page-table",
  TABLE_BODY: "categories-page-table-body",
  ROW_PREFIX: "categories-page-table-row-",
  row: (categoryId: string) => `categories-page-table-row-${categoryId}`,
  ROW_CHECKBOX_PREFIX: "categories-page-table-checkbox-",
  rowCheckbox: (categoryId: string) => `categories-page-table-checkbox-${categoryId}`,
  SORT_TITLE: "categories-page-sort-title",
  SORT_CREATED_AT: "categories-page-sort-created-at",
  DELETE_SELECTED_BUTTON: "categories-page-delete-selected-button",
  DELETE_DIALOG: "categories-page-delete-dialog",
  DELETE_DIALOG_CANCEL_BUTTON: "categories-page-delete-dialog-cancel-button",
  DELETE_DIALOG_CONFIRM_BUTTON: "categories-page-delete-dialog-confirm-button",
} as const;

export const CREATE_CATEGORY_PAGE_HANDLES = {
  PAGE: "create-category-page",
  TITLE_INPUT: "create-category-title-input",
  SUBMIT_BUTTON: "create-category-submit-button",
} as const;

export const CATEGORY_PAGE_HANDLES = {
  PAGE: "category-page",
  HEADING: "category-page-heading",
  TITLE: "category-title-input",
  ARCHIVED: "category-archived-checkbox",
  SAVE: "category-save-button",
} as const;
