export const NEWS_PAGE_HANDLES = {
  PAGE: "news-page",
  HEADING: "news-page-heading",
  STATUS_FILTER: "news-page-status-filter",
  statusFilterOption: (status: "published" | "draft") => `news-page-status-filter-option-${status}`,
  CREATE_BUTTON: "news-page-create-button",
  ITEM_LIST: "news-page-item-list",
  ITEM_PREFIX: "news-page-item-",
  item: (newsId: string) => `news-page-item-${newsId}`,
} as const;

export const NEWS_DETAILS_PAGE_HANDLES = {
  PAGE: "news-details-page",
  TITLE: "news-details-title",
  SUMMARY: "news-details-summary",
  EDIT_BUTTON: "news-details-edit-button",
  DELETE_BUTTON: "news-details-delete-button",
  PREVIOUS_BUTTON: "news-details-previous-button",
  NEXT_BUTTON: "news-details-next-button",
} as const;

export const NEWS_FORM_PAGE_HANDLES = {
  PAGE: "news-form-page",
  TITLE_INPUT: "news-form-title-input",
  SUMMARY_INPUT: "news-form-summary-input",
  STATUS_SELECT: "news-form-status-select",
  statusOption: (status: "draft" | "published") => `news-form-status-option-${status}`,
  IS_PUBLIC_SWITCH: "news-form-is-public-switch",
  CONTENT_EDITOR_TAB: "news-form-content-editor-tab",
  CONTENT_PREVIEW_TAB: "news-form-content-preview-tab",
  SAVE_BUTTON: "news-form-save-button",
  CANCEL_BUTTON: "news-form-cancel-button",
} as const;

export const NEWS_LANGUAGE_SELECTOR_HANDLES = {
  SELECT: "news-language-select",
  DELETE_BUTTON: "news-language-delete-button",
  CREATE_DIALOG: "news-language-create-dialog",
  CREATE_CONFIRM_BUTTON: "news-language-create-confirm-button",
  DELETE_DIALOG: "news-language-delete-dialog",
  DELETE_CONFIRM_BUTTON: "news-language-delete-confirm-button",
} as const;
