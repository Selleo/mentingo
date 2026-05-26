import type { SupportedLanguages } from "@repo/shared";

export type LanguageSelectorTestIds = {
  select?: string;
  deleteButton?: string;
  setBaseLanguageButton?: string;
  setBaseLanguageDialog?: string;
  setBaseLanguageConfirmButton?: string;
  createDialog?: string;
  createConfirmButton?: string;
  deleteDialog?: string;
  deleteConfirmButton?: string;
  option?: (language: SupportedLanguages) => string;
};

export type LanguageSelectorLabels = {
  placeholder?: string;
  baseLanguage?: string;
  notAddedLanguages?: string;
  createTitle?: string;
  createDescription?: string;
  deleteTitle?: string;
  deleteDescription?: string;
  setBaseLanguage?: string;
  setBaseTitle?: string;
  setBaseDescription?: string;
  cancel?: string;
  createConfirm?: string;
  deleteConfirm?: string;
};

export type LanguageSelectorProps = {
  formKey: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
  onCreateLanguage?: (language: SupportedLanguages) => Promise<void> | void;
  onDeleteLanguage?: (language: SupportedLanguages) => Promise<void> | void;
  onSetBaseLanguage?: (language: SupportedLanguages) => Promise<void> | void;
  onLanguageCreated?: (language: SupportedLanguages) => Promise<void> | void;
  onLanguageDeleted?: (
    language: SupportedLanguages,
    fallbackLanguage: SupportedLanguages,
  ) => Promise<void> | void;
  isCreateMode?: boolean;
  canCreateLanguage?: boolean;
  canDeleteLanguage?: boolean;
  canSetBaseLanguage?: boolean;
  testIds?: LanguageSelectorTestIds;
  labels?: LanguageSelectorLabels;
};

export type GetEffectiveLanguageInput = {
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
};

export type LanguageFormKeyPart = string | number | boolean | null | undefined;

export type GetLocalizedResourceLanguageParams = GetEffectiveLanguageInput & {
  onChange: (language: SupportedLanguages) => void;
  formKeyParts: LanguageFormKeyPart[];
};

export type LocalizedResourceLanguageSelectorProps = Pick<
  LanguageSelectorProps,
  "availableLocales" | "baseLanguage" | "formKey" | "onChange" | "value"
>;
