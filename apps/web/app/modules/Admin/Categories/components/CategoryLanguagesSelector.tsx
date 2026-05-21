import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAddCategoryLanguage } from "~/api/mutations/admin/useAddCategoryLanguage";
import { useDeleteCategoryLanguage } from "~/api/mutations/admin/useDeleteCategoryLanguage";
import { useUpdateCategoryBaseLanguage } from "~/api/mutations/admin/useUpdateCategoryBaseLanguage";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

import { CATEGORY_PAGE_HANDLES } from "../../../../../e2e/data/categories/handles";

import type { IconName } from "~/types/shared";

const languageOptions: {
  key: SupportedLanguages;
  iconName: IconName;
  translationKey: string;
}[] = [
  { key: "pl", iconName: "PL", translationKey: "changeUserLanguageView.options.polish" },
  { key: "en", iconName: "GB", translationKey: "changeUserLanguageView.options.english" },
  { key: "de", iconName: "DE", translationKey: "changeUserLanguageView.options.german" },
  { key: "cs", iconName: "CS", translationKey: "changeUserLanguageView.options.czech" },
  { key: "lt", iconName: "LT", translationKey: "changeUserLanguageView.options.lithuanian" },
];

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
  const { t } = useTranslation();
  const { mutateAsync: addLanguage } = useAddCategoryLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteCategoryLanguage();
  const { mutateAsync: updateBaseLanguage } = useUpdateCategoryBaseLanguage();

  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSetBaseOpen, setIsSetBaseOpen] = useState(false);

  const { addedItems, notAddedItems } = useMemo(() => {
    const added = languageOptions.filter((item) => availableLocales?.includes(item.key));
    const notAdded = languageOptions.filter((item) => !availableLocales?.includes(item.key));

    return { addedItems: added, notAddedItems: notAdded };
  }, [availableLocales]);

  const handleChange = (lang: SupportedLanguages) => {
    if (availableLocales?.includes(lang)) {
      onChange(lang);
      return;
    }

    setLanguageToCreate(lang);
    setIsCreateOpen(true);
  };

  const handleCreateLanguage = async () => {
    if (!languageToCreate) return;

    await addLanguage({ id: categoryId, language: languageToCreate });
    setIsCreateOpen(false);
    onChange(languageToCreate);
    setLanguageToCreate(null);
  };

  const handleDeleteLanguage = async () => {
    if (!languageToDelete) return;

    await deleteLanguage({ id: categoryId, language: languageToDelete });
    setIsDeleteOpen(false);

    const fallback =
      (baseLanguage && baseLanguage !== languageToDelete && baseLanguage) ||
      availableLocales?.find((locale) => locale !== languageToDelete) ||
      SUPPORTED_LANGUAGES.EN;

    onChange(fallback);
    setLanguageToDelete(null);
  };

  const handleSetBaseLanguage = async () => {
    await updateBaseLanguage({ id: categoryId, baseLanguage: value });
    setIsSetBaseOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(val) => handleChange(val as SupportedLanguages)}>
        <SelectTrigger
          className="min-w-[200px]"
          data-testid={CATEGORY_PAGE_HANDLES.LANGUAGE_SELECT}
        >
          <SelectValue placeholder={t("adminCategoryView.language.label")} />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem value={item.key} key={item.key} className="w-full">
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {baseLanguage === item.key && (
                  <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                    {t("adminCategoryView.language.baseLanguage")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}

          {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

          {notAddedItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                {t("adminCategoryView.language.notAddedLanguages")}
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

      {baseLanguage && baseLanguage !== value && (
        <>
          <Button
            data-testid={CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_BUTTON}
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setIsSetBaseOpen(true)}
          >
            {t("adminCategoryView.language.setBaseLanguage")}
          </Button>
          <Button
            data-testid={CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON}
            size="icon"
            type="button"
            variant="outline"
            className="shrink-0 rounded-lg p-1"
            onClick={() => {
              setLanguageToDelete(value);
              setIsDeleteOpen(true);
            }}
          >
            <Icon name="TrashIcon" className="size-5" />
          </Button>
        </>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent data-testid={CATEGORY_PAGE_HANDLES.CREATE_LANGUAGE_DIALOG}>
          <DialogHeader>
            <DialogTitle>{t("adminCategoryView.language.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminCategoryView.language.createDescription", {
                language: t(
                  languageOptions.find((item) => item.key === languageToCreate)?.translationKey ??
                    "",
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              data-testid={CATEGORY_PAGE_HANDLES.CREATE_LANGUAGE_CONFIRM_BUTTON}
              onClick={handleCreateLanguage}
            >
              {t("contentCreatorView.button.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSetBaseOpen} onOpenChange={setIsSetBaseOpen}>
        <DialogContent data-testid={CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_DIALOG}>
          <DialogHeader>
            <DialogTitle>{t("adminCategoryView.language.setBaseTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminCategoryView.language.setBaseDescription", {
                language: t(
                  languageOptions.find((item) => item.key === value)?.translationKey ?? "",
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSetBaseOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              data-testid={CATEGORY_PAGE_HANDLES.SET_BASE_LANGUAGE_CONFIRM_BUTTON}
              onClick={handleSetBaseLanguage}
            >
              {t("contentCreatorView.button.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent data-testid={CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_DIALOG}>
          <DialogHeader>
            <DialogTitle>{t("adminCategoryView.language.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminCategoryView.language.deleteDescription", {
                language: t(
                  languageOptions.find((item) => item.key === languageToDelete)?.translationKey ??
                    "",
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              data-testid={CATEGORY_PAGE_HANDLES.DELETE_LANGUAGE_CONFIRM_BUTTON}
              variant="destructive"
              onClick={handleDeleteLanguage}
            >
              {t("common.button.proceed")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
