export const GROUPS_PAGE_HANDLES = {
  PAGE: "groups-page",
  HEADING: "groups-page-heading",
  CREATE_BUTTON: "groups-page-create-button",
  DELETE_SELECTED_BUTTON: "groups-page-delete-selected-button",
  DELETE_DIALOG: "groups-page-delete-dialog",
  DELETE_DIALOG_CANCEL_BUTTON: "groups-page-delete-dialog-cancel-button",
  DELETE_DIALOG_CONFIRM_BUTTON: "groups-page-delete-dialog-confirm-button",
  SELECT_ALL_CHECKBOX: "groups-page-select-all-checkbox",
  TABLE: "groups-page-table",
  TABLE_BODY: "groups-page-table-body",
  ROW_PREFIX: "groups-page-table-row-",
  row: (groupId: string) => `groups-page-table-row-${groupId}`,
  ROW_CHECKBOX_PREFIX: "groups-page-table-checkbox-",
  rowCheckbox: (groupId: string) => `groups-page-table-checkbox-${groupId}`,
  SORT_NAME: "groups-page-sort-name",
  SORT_CHARACTERISTIC: "groups-page-sort-characteristic",
} as const;

export const GROUP_FORM_HANDLES = {
  NAME_INPUT: "group-form-name-input",
  CHARACTERISTIC_INPUT: "group-form-characteristic-input",
  LANGUAGE_SELECT: "group-form-language-select",
  CANCEL_BUTTON: "group-form-cancel-button",
  SUBMIT_BUTTON: "group-form-submit-button",
} as const;

export const GROUP_LANGUAGE_SELECTOR_HANDLES = {
  SELECT: "group-language-select",
  DELETE_BUTTON: "group-language-delete-button",
  SET_BASE_LANGUAGE_BUTTON: "group-language-set-base-button",
  SET_BASE_LANGUAGE_DIALOG: "group-language-set-base-dialog",
  SET_BASE_LANGUAGE_CONFIRM_BUTTON: "group-language-set-base-confirm-button",
  CREATE_DIALOG: "group-language-create-dialog",
  CREATE_CONFIRM_BUTTON: "group-language-create-confirm-button",
  DELETE_DIALOG: "group-language-delete-dialog",
  DELETE_CONFIRM_BUTTON: "group-language-delete-confirm-button",
  option: (language: string) => `group-language-option-${language}`,
} as const;

export const CREATE_GROUP_PAGE_HANDLES = {
  PAGE: "create-group-page",
  HEADING: "create-group-page-heading",
} as const;

export const GROUP_PAGE_HANDLES = {
  PAGE: "group-page",
  HEADING: "group-page-heading",
} as const;
