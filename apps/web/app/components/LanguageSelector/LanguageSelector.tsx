import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

import { languageOptions } from "./languageOptions";
import { getEffectiveLanguage } from "./utils";

import type { LanguageSelectorLabels, LanguageSelectorProps } from "./types";

const defaultLabels = {
  placeholder: "changeUserLanguageView.field.language",
  baseLanguage: "adminCourseView.common.baseLanguage",
  notAddedLanguages: "adminCourseView.common.notAddedLanguages",
  createTitle: "adminCourseView.createLanguage.title",
  createDescription: "adminCourseView.createLanguage.description",
  deleteTitle: "adminCourseView.deleteLanguage.title",
  deleteDescription: "adminCourseView.deleteLanguage.description",
  setBaseLanguage: "adminCourseView.common.baseLanguage",
  setBaseTitle: "adminCourseView.common.baseLanguage",
  setBaseDescription: "adminCourseView.common.baseLanguage",
  cancel: "common.button.cancel",
  createConfirm: "contentCreatorView.button.confirm",
  deleteConfirm: "common.button.proceed",
} satisfies Required<LanguageSelectorLabels>;

export const LanguageSelector = ({
  formKey,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreateLanguage,
  onDeleteLanguage,
  onSetBaseLanguage,
  onLanguageCreated,
  onLanguageDeleted,
  isCreateMode = false,
  canCreateLanguage = Boolean(onCreateLanguage),
  canDeleteLanguage = Boolean(onDeleteLanguage),
  canSetBaseLanguage = Boolean(onSetBaseLanguage),
  testIds,
  labels,
}: LanguageSelectorProps) => {
  const { t } = useTranslation();

  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);
  const [createdLocales, setCreatedLocales] = useState<SupportedLanguages[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSetBaseOpen, setIsSetBaseOpen] = useState(false);

  const labelKeys = { ...defaultLabels, ...labels };

  const effectiveAvailableLocales = useMemo(
    () => [...new Set([...(availableLocales ?? []), ...createdLocales])],
    [availableLocales, createdLocales],
  );

  const effectiveLanguage = getEffectiveLanguage({
    value,
    baseLanguage,
    availableLocales: effectiveAvailableLocales,
  });

  const { addedItems, notAddedItems } = useMemo(() => {
    if (isCreateMode) return { addedItems: languageOptions, notAddedItems: [] };

    const available = new Set(effectiveAvailableLocales);
    return {
      addedItems: languageOptions.filter((item) => available.has(item.key)),
      notAddedItems: canCreateLanguage
        ? languageOptions.filter((item) => !available.has(item.key))
        : [],
    };
  }, [canCreateLanguage, effectiveAvailableLocales, isCreateMode]);

  const getLanguageLabel = (language: SupportedLanguages | null) =>
    t(languageOptions.find((item) => item.key === language)?.translationKey ?? "");

  const getFallbackLanguage = (deletedLanguage: SupportedLanguages) =>
    (baseLanguage && baseLanguage !== deletedLanguage && baseLanguage) ||
    effectiveAvailableLocales.find((locale) => locale !== deletedLanguage) ||
    SUPPORTED_LANGUAGES.EN;

  const canDisplayDeleteButton =
    !isCreateMode && canDeleteLanguage && baseLanguage && baseLanguage !== effectiveLanguage;

  const canDisplaySetBaseLanguageButton =
    !isCreateMode && canSetBaseLanguage && baseLanguage && baseLanguage !== effectiveLanguage;

  const handleLanguageChange = (language: SupportedLanguages) => {
    if (isCreateMode || effectiveAvailableLocales.includes(language)) {
      onChange(language);
      return;
    }

    if (!canCreateLanguage) return;

    setLanguageToCreate(language);
    setIsCreateOpen(true);
  };

  const handleCreateLanguage = async () => {
    if (!languageToCreate || !onCreateLanguage) return;

    await onCreateLanguage(languageToCreate);
    setCreatedLocales((locales) => [...new Set([...locales, languageToCreate])]);
    await onLanguageCreated?.(languageToCreate);
    onChange(languageToCreate);
    setIsCreateOpen(false);
    setLanguageToCreate(null);
  };

  const handleDeleteLanguage = async () => {
    if (!languageToDelete || !onDeleteLanguage) return;

    await onDeleteLanguage(languageToDelete);
    const fallbackLanguage = getFallbackLanguage(languageToDelete);
    setCreatedLocales((locales) => locales.filter((locale) => locale !== languageToDelete));
    await onLanguageDeleted?.(languageToDelete, fallbackLanguage);
    onChange(fallbackLanguage);
    setIsDeleteOpen(false);
    setLanguageToDelete(null);
  };

  const handleSetBaseLanguage = async () => {
    if (!onSetBaseLanguage) return;

    await onSetBaseLanguage(effectiveLanguage);
    setIsSetBaseOpen(false);
  };

  return (
    <div key={formKey} className="flex items-center gap-2">
      <Select
        value={effectiveLanguage}
        onValueChange={(nextValue) => handleLanguageChange(nextValue as SupportedLanguages)}
      >
        <SelectTrigger className="min-w-[200px]" data-testid={testIds?.select}>
          <SelectValue placeholder={t(labelKeys.placeholder)} />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem
              value={item.key}
              key={item.key}
              className="w-full"
              data-testid={testIds?.option?.(item.key)}
            >
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {!isCreateMode && baseLanguage === item.key && (
                  <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                    {t(labelKeys.baseLanguage)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}

          {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

          {notAddedItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                {t(labelKeys.notAddedLanguages)}
              </div>
              {notAddedItems.map((item) => (
                <SelectItem
                  value={item.key}
                  key={item.key}
                  data-testid={testIds?.option?.(item.key)}
                >
                  <div className="flex w-full items-center gap-2">
                    <Icon name={item.iconName} className="size-4" />
                    <span className="font-semibold">{t(item.translationKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {canDisplayDeleteButton && (
        <Button
          data-testid={testIds?.deleteButton}
          size="icon"
          type="button"
          variant="outline"
          className="shrink-0 rounded-lg p-1"
          onClick={() => {
            setLanguageToDelete(effectiveLanguage);
            setIsDeleteOpen(true);
          }}
        >
          <Icon name="TrashIcon" className="size-5" />
        </Button>
      )}

      {canDisplaySetBaseLanguageButton && (
        <Button
          data-testid={testIds?.setBaseLanguageButton}
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => setIsSetBaseOpen(true)}
        >
          {t(labelKeys.setBaseLanguage)}
        </Button>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent data-testid={testIds?.createDialog}>
          <DialogHeader>
            <DialogTitle>{t(labelKeys.createTitle)}</DialogTitle>
            <DialogDescription>
              {t(labelKeys.createDescription, { language: getLanguageLabel(languageToCreate) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t(labelKeys.cancel)}
            </Button>
            <Button data-testid={testIds?.createConfirmButton} onClick={handleCreateLanguage}>
              {t(labelKeys.createConfirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSetBaseOpen} onOpenChange={setIsSetBaseOpen}>
        <DialogContent data-testid={testIds?.setBaseLanguageDialog}>
          <DialogHeader>
            <DialogTitle>{t(labelKeys.setBaseTitle)}</DialogTitle>
            <DialogDescription>
              {t(labelKeys.setBaseDescription, { language: getLanguageLabel(effectiveLanguage) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSetBaseOpen(false)}>
              {t(labelKeys.cancel)}
            </Button>
            <Button
              data-testid={testIds?.setBaseLanguageConfirmButton}
              onClick={handleSetBaseLanguage}
            >
              {t(labelKeys.createConfirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent data-testid={testIds?.deleteDialog}>
          <DialogHeader>
            <DialogTitle>{t(labelKeys.deleteTitle)}</DialogTitle>
            <DialogDescription>
              {t(labelKeys.deleteDescription, { language: getLanguageLabel(languageToDelete) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t(labelKeys.cancel)}
            </Button>
            <Button
              data-testid={testIds?.deleteConfirmButton}
              variant="destructive"
              onClick={handleDeleteLanguage}
            >
              {t(labelKeys.deleteConfirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
