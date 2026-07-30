import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useDeleteArticleSection } from "~/api/mutations/admin/useDeleteArticleSection";
import { useDeleteArticleSectionLanguage } from "~/api/mutations/admin/useDeleteArticleSectionLanguage";
import { useUpdateArticleSection } from "~/api/mutations/admin/useUpdateArticleSection";
import { useArticleSection } from "~/api/queries/useArticleSection";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  createArticleSectionFormSchema,
  type ArticleSectionFormValues,
} from "~/modules/Articles/ArticleSectionForm.schema";
import { ArticleSectionLanguageSelector } from "~/modules/Articles/LanguageSelector";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ARTICLE_SECTION_FORM_HANDLES } from "../../../../../e2e/data/articles/handles";

import type { SupportedLanguages } from "@repo/shared";

type EditArticleSectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string;
};

const emptySectionTranslation = { title: "" };

export function EditArticleSectionSheet({
  open,
  onOpenChange,
  sectionId,
}: EditArticleSectionSheetProps) {
  const { t } = useTranslation();
  const { language: initialLanguage } = useLanguageStore();
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguages>(initialLanguage);
  const [availableLocales, setAvailableLocales] = useState<SupportedLanguages[]>([]);
  const [baseLanguage, setBaseLanguage] = useState<SupportedLanguages>();
  const { data: section, isFetching } = useArticleSection(
    sectionId ?? "",
    open ? activeLanguage : undefined,
  );
  const { mutateAsync: updateSection, isPending: isUpdating } = useUpdateArticleSection();
  const { mutateAsync: deleteSection, isPending: isDeleting } = useDeleteArticleSection();
  const { mutateAsync: deleteSectionLanguage } = useDeleteArticleSectionLanguage();

  const schema = useMemo(
    () =>
      createArticleSectionFormSchema(
        availableLocales,
        section?.availableLocales ?? [],
        t("adminArticleView.section.fields.titleError"),
      ),
    [availableLocales, section?.availableLocales, t],
  );
  const form = useForm<ArticleSectionFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      translations: { [initialLanguage]: emptySectionTranslation },
    },
    mode: "onChange",
  });
  const { formState, getFieldState, reset, resetField, setValue } = form;

  useEffect(() => {
    if (!open) return;
    setActiveLanguage(initialLanguage);
    setAvailableLocales([]);
    setBaseLanguage(undefined);
    reset({
      translations: { [initialLanguage]: emptySectionTranslation },
    });
  }, [initialLanguage, open, reset, sectionId]);

  useEffect(() => {
    if (!open || !section || isFetching) return;

    setBaseLanguage(section.baseLanguage);
    setAvailableLocales((previous) => {
      const mergedLocales = [...new Set([...previous, ...section.availableLocales])];
      const isUnchanged =
        mergedLocales.length === previous.length &&
        mergedLocales.every((locale, index) => locale === previous[index]);

      return isUnchanged ? previous : mergedLocales;
    });

    const isPersistedLocale = section.availableLocales.includes(activeLanguage);
    const isStagedLocale = availableLocales.includes(activeLanguage);
    if (!isPersistedLocale && !isStagedLocale) {
      setActiveLanguage(section.baseLanguage);
      return;
    }
    const titlePath = `translations.${activeLanguage}.title` as const;
    if (!getFieldState(titlePath).isDirty) {
      resetField(titlePath, { defaultValue: section.title ?? "" });
    }
  }, [activeLanguage, availableLocales, getFieldState, isFetching, open, resetField, section]);

  if (!sectionId) return null;

  const changeLanguage = (language: SupportedLanguages) => setActiveLanguage(language);

  const addLanguage = async (language: SupportedLanguages) => {
    setAvailableLocales((previous) => [...new Set([...previous, language])]);
    setValue(`translations.${language}` as const, emptySectionTranslation, {
      shouldDirty: true,
    });
    changeLanguage(language);
  };

  const deleteLanguage = async (language: SupportedLanguages) => {
    if (section?.availableLocales.includes(language)) {
      await deleteSectionLanguage({ id: sectionId, language });
    }
    setAvailableLocales((previous) => previous.filter((locale) => locale !== language));
    form.unregister(`translations.${language}` as const);
    resetField(`translations.${language}` as const);
    if (activeLanguage === language && baseLanguage) changeLanguage(baseLanguage);
  };

  const hasDirtyTranslation = (language: SupportedLanguages) => {
    const dirtyTranslation = formState.dirtyFields.translations?.[language];
    if (!dirtyTranslation) return false;
    if (typeof dirtyTranslation === "boolean") return dirtyTranslation;
    return Object.values(dirtyTranslation).some(Boolean);
  };

  const persistedLocales = section?.availableLocales ?? [];
  const hasChanges = availableLocales.some(
    (language) => hasDirtyTranslation(language) || !persistedLocales.includes(language),
  );

  const onSubmit = async (values: ArticleSectionFormValues) => {
    if (!hasChanges) return;
    const translations = availableLocales
      .filter((language) => hasDirtyTranslation(language) || !persistedLocales.includes(language))
      .map((language) => ({ language, ...values.translations[language] }));

    await updateSection({ sectionId, translations });
    onOpenChange(false);
  };

  const invalidSubmit = (errors: typeof formState.errors) => {
    const invalidLanguage = availableLocales.find(
      (language) => errors.translations?.[language]?.title,
    );
    if (invalidLanguage) changeLanguage(invalidLanguage);
  };

  const canDeleteSection = (section?.assignedArticlesCount ?? 0) === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[28rem] max-w-[92vw] p-0 sm:max-w-[32rem]">
        <div className="flex h-dvh flex-col">
          <div className="border-b border-border p-6 pb-4">
            <SheetHeader className="space-y-1">
              <SheetTitle>{t("adminArticleView.section.editTitle")}</SheetTitle>
              <SheetDescription>{t("adminArticleView.section.editDescription")}</SheetDescription>
            </SheetHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
            <Form {...form}>
              <form
                id="edit-article-section-form"
                onSubmit={form.handleSubmit(onSubmit, invalidSubmit)}
                className="flex flex-col gap-4"
              >
                <Card>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-2">
                      <Label>{t("adminArticleView.section.languageLabel")}</Label>
                      {baseLanguage && (
                        <ArticleSectionLanguageSelector
                          formKey={`${sectionId}-${availableLocales.join("-")}`}
                          value={activeLanguage}
                          baseLanguage={baseLanguage}
                          availableLocales={availableLocales}
                          onChange={changeLanguage}
                          onCreateLanguage={addLanguage}
                          onDeleteLanguage={deleteLanguage}
                        />
                      )}
                      <div className="text-xs text-neutral-500">
                        {t("adminArticleView.section.languageHelp")}
                      </div>
                    </div>

                    <FormField
                      key={`section-title-${activeLanguage}`}
                      control={form.control}
                      name={`translations.${activeLanguage}.title` as const}
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <Label htmlFor="section-title">
                            <span className="mr-1 text-error-600">*</span>
                            {t("adminArticleView.section.fields.title")}
                          </Label>
                          <FormControl>
                            <Input
                              {...field}
                              id="section-title"
                              data-testid={ARTICLE_SECTION_FORM_HANDLES.TITLE_INPUT}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isUpdating || isDeleting}
                      >
                        {t("common.button.cancel")}
                      </Button>
                      <Button
                        data-testid={ARTICLE_SECTION_FORM_HANDLES.SAVE_BUTTON}
                        type="submit"
                        form="edit-article-section-form"
                        disabled={!hasChanges || isUpdating || isFetching || isDeleting}
                      >
                        {t("common.button.save")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <p className="font-semibold text-destructive">
                      {t("adminArticleView.section.delete.title")}
                    </p>
                    {canDeleteSection && (
                      <p className="text-sm text-neutral-600">
                        {t("adminArticleView.section.delete.description")}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {!canDeleteSection && (
                      <p className="text-sm text-neutral-600">
                        {t("adminArticleView.section.cannotDeleteWithArticles")}
                      </p>
                    )}

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          data-testid={ARTICLE_SECTION_FORM_HANDLES.DELETE_BUTTON}
                          type="button"
                          variant="destructive"
                          disabled={!canDeleteSection || isUpdating || isDeleting}
                          className="ml-auto w-fit"
                        >
                          <Icon name="TrashIcon" className="mr-2 size-4" />
                          {t("common.button.delete")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        className="max-w-md"
                        noCloseButton={isDeleting}
                        data-testid={ARTICLE_SECTION_FORM_HANDLES.DELETE_DIALOG}
                      >
                        <DialogTitle>{t("adminArticleView.section.delete.title")}</DialogTitle>
                        <DialogDescription>
                          {t("adminArticleView.section.delete.description")}
                        </DialogDescription>
                        <div className="flex justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant="ghost" disabled={isDeleting}>
                              {t("common.button.cancel")}
                            </Button>
                          </DialogClose>
                          <Button
                            data-testid={ARTICLE_SECTION_FORM_HANDLES.DELETE_CONFIRM_BUTTON}
                            type="button"
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={async () => {
                              await deleteSection({ sectionId });
                              onOpenChange(false);
                            }}
                          >
                            {t("common.button.delete")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
