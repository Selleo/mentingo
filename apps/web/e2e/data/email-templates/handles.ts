import type { SupportedLanguages } from "@repo/shared";

export const EMAIL_TEMPLATES_HANDLES = {
  PAGE: "email-templates-page",
  CREATE_BUTTON: "email-templates-create-button",
  DELETE_SELECTED_BUTTON: "email-templates-delete-selected-button",
  DELETE_CONFIRM_BUTTON: "email-templates-delete-confirm-button",
  NAME_FILTER: "email-templates-name-filter",
  STATUS_FILTER: "email-templates-status-filter",
  statusFilterOption: (status: string) => `email-templates-status-filter-option-${status}`,
  PAGINATION_NEXT: "email-templates-pagination-next",
  PAGINATION_PREVIOUS: "email-templates-pagination-previous",
  paginationPage: (page: number) => `email-templates-pagination-page-${page}`,
  PAGINATION_ITEMS_PER_PAGE: "email-templates-pagination-items-per-page",
  paginationItemsPerPageOption: (itemsPerPage: number) =>
    `email-templates-pagination-items-per-page-option-${itemsPerPage}`,
  row: (id: string) => `email-templates-row-${id}`,
  rowCheckbox: (id: string) => `email-templates-row-checkbox-${id}`,
};

export const EDIT_EMAIL_TEMPLATE_HANDLES = {
  PAGE: "edit-email-template-page",
  NAME_BUTTON: "edit-email-template-name-button",
  NAME_INPUT: "edit-email-template-name-input",
  STATUS_SELECT: "edit-email-template-status-select",
  SAVE_BUTTON: "edit-email-template-save-button",
  DUPLICATE_BUTTON: "edit-email-template-duplicate-button",
  SEND_TEST_BUTTON: "edit-email-template-send-test-button",
  SUBJECT_INPUT: "edit-email-template-subject-input",
  LANGUAGE_SELECT: "edit-email-template-language-select",
  languageOption: (language: SupportedLanguages) =>
    `edit-email-template-language-option-${language}`,
  LANGUAGE_CREATE_CONFIRM_BUTTON: "edit-email-template-language-create-confirm-button",
  LANGUAGE_DELETE_BUTTON: "edit-email-template-language-delete-button",
  LANGUAGE_DELETE_CONFIRM_BUTTON: "edit-email-template-language-delete-confirm-button",
  LANGUAGE_SET_BASE_BUTTON: "edit-email-template-language-set-base-button",
  LANGUAGE_SET_BASE_CONFIRM_BUTTON: "edit-email-template-language-set-base-confirm-button",
};
