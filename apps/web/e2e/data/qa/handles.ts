import type { SupportedLanguages } from "@repo/shared";

export const QA_PAGE_HANDLES = {
  PAGE: "qa-page",
  HEADING: "qa-page-heading",
  CREATE_BUTTON: "qa-page-create-button",
  ITEM_LIST: "qa-page-item-list",
  item: (qaId: string) => `qa-page-item-${qaId}`,
  itemTrigger: (qaId: string) => `qa-page-item-${qaId}-trigger`,
  itemContent: (qaId: string) => `qa-page-item-${qaId}-content`,
  itemTitle: (qaId: string) => `qa-page-item-${qaId}-title`,
  itemDescription: (qaId: string) => `qa-page-item-${qaId}-description`,
  itemEditButton: (qaId: string) => `qa-page-item-${qaId}-edit-button`,
  itemDeleteButton: (qaId: string) => `qa-page-item-${qaId}-delete-button`,
} as const;

export const QA_FORM_PAGE_HANDLES = {
  PAGE: "qa-form-page",
  LANGUAGE_SELECT: "qa-form-language-select",
  languageOption: (language: SupportedLanguages) => `qa-form-language-option-${language}`,
  TITLE_INPUT: "qa-form-title-input",
  DESCRIPTION_INPUT: "qa-form-description-input",
  SAVE_BUTTON: "qa-form-save-button",
  CANCEL_BUTTON: "qa-form-cancel-button",
} as const;

export const QA_LANGUAGE_SELECTOR_HANDLES = {
  SELECT: "qa-language-select",
  option: (language: SupportedLanguages) => `qa-language-option-${language}`,
  DELETE_BUTTON: "qa-language-delete-button",
  CREATE_DIALOG: "qa-language-create-dialog",
  CREATE_CONFIRM_BUTTON: "qa-language-create-confirm-button",
  DELETE_DIALOG: "qa-language-delete-dialog",
  DELETE_CONFIRM_BUTTON: "qa-language-delete-confirm-button",
} as const;

export const QA_DELETE_DIALOG_HANDLES = {
  DIALOG: "qa-delete-dialog",
  CONFIRM_BUTTON: "qa-delete-confirm-button",
  CANCEL_BUTTON: "qa-delete-cancel-button",
} as const;

export const QA_SETTINGS_HANDLES = {
  PREFERENCES_CARD: "qa-settings-preferences-card",
  ENABLED_SWITCH: "qa-settings-enabled-switch",
  PUBLIC_SWITCH: "qa-settings-public-switch",
} as const;
