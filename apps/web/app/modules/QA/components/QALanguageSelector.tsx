import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { courseLanguages } from "~/modules/Admin/EditCourse/compontents/LanguageSelector";

import { CreateQALanguageDialog } from "./CreateQALanguageDialog";
import { DeleteQALanguageDialog } from "./DeleteQALanguageDialog";

import type { SupportedLanguages } from "@repo/shared";

type QALanguageSelectorProps = {
  qaLanguage: SupportedLanguages;
  qa?: {
    id: string;
    baseLanguage?: SupportedLanguages | null;
    availableLocales?: SupportedLanguages[];
  };
  onChange: (language: SupportedLanguages) => void;
};

export const QALanguageSelector = ({ qaLanguage, qa, onChange }: QALanguageSelectorProps) => {
  const { t } = useTranslation();

  const [createNewLanguageDialog, setCreateNewLanguageDialog] = useState(false);
  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const addedItems = courseLanguages.filter((item) => !!qa?.availableLocales?.includes(item.key));
  const notAddedItems = courseLanguages.filter(
    (item) => !(qa?.availableLocales?.includes(item.key) ?? false),
  );

  const handleLanguageChange = (key: SupportedLanguages) => {
    if (!(qa?.availableLocales?.includes(key) ?? false)) {
      setCreateNewLanguageDialog(true);
      setLanguageToCreate(key);
    } else {
      onChange(key);
    }
  };

  const handleCreatedLanguage = (language: SupportedLanguages) => {
    onChange(language);
    setLanguageToCreate(null);
  };

  const handleDeletedLanguage = () => {
    if (!qa?.baseLanguage) return;

    onChange(qa.baseLanguage);
  };

  return (
    <div className="flex gap-2 items-center">
      <Select value={qaLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem value={item.key} key={item.key} className="w-full">
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {qa?.baseLanguage === item.key && (
                  <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                    {t("adminCourseView.common.baseLanguage")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}

          {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

          {notAddedItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                {t("adminCourseView.common.notAddedLanguages")}
              </div>
              {notAddedItems.map((item) => (
                <SelectItem value={item.key} key={item.key}>
                  <div className="flex w-full items-center gap-2">
                    <Icon name={item.iconName} className="size-4" />
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold">{t(item.translationKey)}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {qa?.baseLanguage !== qaLanguage && (
        <Button
          size="icon"
          type="button"
          variant="outline"
          className="shrink-0 p-1 rounded-lg"
          onClick={() => {
            setLanguageToDelete(qaLanguage);
            setIsDeleteDialogOpen(true);
          }}
        >
          <Icon name="TrashIcon" className="size-5" />
        </Button>
      )}

      {languageToCreate && qa && (
        <CreateQALanguageDialog
          open={createNewLanguageDialog}
          setOpen={setCreateNewLanguageDialog}
          qaId={qa.id}
          languageToCreate={languageToCreate}
          onConfirm={handleCreatedLanguage}
        />
      )}

      <DeleteQALanguageDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        qaId={qa?.id}
        language={languageToDelete}
        onDeleted={handleDeletedLanguage}
      />
    </div>
  );
};
