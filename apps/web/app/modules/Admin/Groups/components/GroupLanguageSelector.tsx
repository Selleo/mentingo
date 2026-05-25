import { useCreateGroupLanguage } from "~/api/mutations/admin/useCreateGroupLanguage";
import { useDeleteGroupLanguage } from "~/api/mutations/admin/useDeleteGroupLanguage";
import { useUpdateGroupBaseLanguage } from "~/api/mutations/admin/useUpdateGroupBaseLanguage";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import { GROUP_LANGUAGE_SELECTOR_HANDLES } from "../../../../../e2e/data/groups/handles";

import type { SupportedLanguages } from "@repo/shared";
import type { GetGroupByIdResponse } from "~/api/generated-api";

type GroupLanguageSelectorProps = {
  formKey: string;
  group?: GetGroupByIdResponse["data"];
  value: SupportedLanguages;
  onChange: (language: SupportedLanguages) => void;
  onLanguageCreated?: (language: SupportedLanguages) => void;
  isCreateMode?: boolean;
  selectTestId?: string;
};

export const GroupLanguageSelector = ({
  formKey,
  group,
  value,
  onChange,
  onLanguageCreated,
  isCreateMode = false,
  selectTestId,
}: GroupLanguageSelectorProps) => {
  const { mutateAsync: createLanguage } = useCreateGroupLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteGroupLanguage();
  const { mutateAsync: updateBaseLanguage } = useUpdateGroupBaseLanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    if (!group) return;

    await createLanguage({ groupId: group.id, language });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    if (!group) return;

    await deleteLanguage({ groupId: group.id, language });
  };

  const handleSetBaseLanguage = async (baseLanguage: SupportedLanguages) => {
    if (!group) return;

    await updateBaseLanguage({ groupId: group.id, baseLanguage });
  };

  return (
    <LanguageSelector
      formKey={formKey}
      value={value}
      baseLanguage={group?.baseLanguage}
      availableLocales={group?.availableLocales}
      onChange={onChange}
      onCreateLanguage={handleCreateLanguage}
      onLanguageCreated={onLanguageCreated}
      onDeleteLanguage={handleDeleteLanguage}
      onSetBaseLanguage={handleSetBaseLanguage}
      isCreateMode={isCreateMode}
      canCreateLanguage={Boolean(group)}
      canDeleteLanguage={Boolean(group)}
      canSetBaseLanguage={Boolean(group)}
      testIds={{
        select: selectTestId ?? GROUP_LANGUAGE_SELECTOR_HANDLES.SELECT,
        deleteButton: GROUP_LANGUAGE_SELECTOR_HANDLES.DELETE_BUTTON,
        setBaseLanguageButton: GROUP_LANGUAGE_SELECTOR_HANDLES.SET_BASE_LANGUAGE_BUTTON,
        setBaseLanguageDialog: GROUP_LANGUAGE_SELECTOR_HANDLES.SET_BASE_LANGUAGE_DIALOG,
        setBaseLanguageConfirmButton:
          GROUP_LANGUAGE_SELECTOR_HANDLES.SET_BASE_LANGUAGE_CONFIRM_BUTTON,
        createDialog: GROUP_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG,
        createConfirmButton: GROUP_LANGUAGE_SELECTOR_HANDLES.CREATE_CONFIRM_BUTTON,
        deleteDialog: GROUP_LANGUAGE_SELECTOR_HANDLES.DELETE_DIALOG,
        deleteConfirmButton: GROUP_LANGUAGE_SELECTOR_HANDLES.DELETE_CONFIRM_BUTTON,
        option: GROUP_LANGUAGE_SELECTOR_HANDLES.option,
      }}
      labels={{
        setBaseLanguage: "adminGroupsView.language.setBaseLanguage",
        setBaseTitle: "adminGroupsView.language.setBaseTitle",
        setBaseDescription: "adminGroupsView.language.setBaseDescription",
      }}
    />
  );
};
