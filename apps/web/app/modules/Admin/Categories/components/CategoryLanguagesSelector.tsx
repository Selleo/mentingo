import { useAddCategoryLanguage } from "~/api/mutations/admin/useAddCategoryLanguage";
import { useDeleteCategoryLanguage } from "~/api/mutations/admin/useDeleteCategoryLanguage";
import { useUpdateCategoryBaseLanguage } from "~/api/mutations/admin/useUpdateCategoryBaseLanguage";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import { CATEGORY_PAGE_HANDLES } from "../../../../../e2e/data/categories/handles";

import type { SupportedLanguages } from "@repo/shared";

type CategoryLanguagesSelectorProps = {
  categoryId: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
};

export const CategoryLanguagesSelector = ({
  categoryId,
  value,
  baseLanguage,
  availableLocales,
  onChange,
}: CategoryLanguagesSelectorProps) => {
  const { mutateAsync: addLanguage } = useAddCategoryLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteCategoryLanguage();
  const { mutateAsync: updateBaseLanguage } = useUpdateCategoryBaseLanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    await addLanguage({ id: categoryId, language });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    await deleteLanguage({ id: categoryId, language });
  };

  const handleSetBaseLanguage = async (language: SupportedLanguages) => {
    await updateBaseLanguage({ id: categoryId, baseLanguage: language });
  };

  return (
    <LanguageSelector
      formKey={[categoryId, baseLanguage, availableLocales?.join(",")].filter(Boolean).join(":")}
      value={value}
      baseLanguage={baseLanguage}
      availableLocales={availableLocales}
      onChange={onChange}
      onCreateLanguage={handleCreateLanguage}
      onDeleteLanguage={handleDeleteLanguage}
      onSetBaseLanguage={handleSetBaseLanguage}
      testIds={{
        select: CATEGORY_PAGE_HANDLES.LANGUAGE_SELECT,
        deleteButton: CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON,
        setBaseLanguageButton: CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_BUTTON,
        setBaseLanguageDialog: CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_DIALOG,
        setBaseLanguageConfirmButton: CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_CONFIRM_BUTTON,
        createDialog: CATEGORY_PAGE_HANDLES.CREATE_LANGUAGE_DIALOG,
        createConfirmButton: CATEGORY_PAGE_HANDLES.CREATE_LANGUAGE_CONFIRM_BUTTON,
        deleteDialog: CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_DIALOG,
        deleteConfirmButton: CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_CONFIRM_BUTTON,
      }}
      labels={{
        placeholder: "adminCategoryView.language.label",
        baseLanguage: "adminCategoryView.language.baseLanguage",
        notAddedLanguages: "adminCategoryView.language.notAddedLanguages",
        createTitle: "adminCategoryView.language.createTitle",
        createDescription: "adminCategoryView.language.createDescription",
        deleteTitle: "adminCategoryView.language.deleteTitle",
        deleteDescription: "adminCategoryView.language.deleteDescription",
        setBaseLanguage: "adminCategoryView.language.setBaseLanguage",
        setBaseTitle: "adminCategoryView.language.setBaseTitle",
        setBaseDescription: "adminCategoryView.language.setBaseDescription",
      }}
    />
  );
};
