import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAddArticleSectionLanguage } from "~/api/mutations/admin/useAddArticleSectionLanguage";
import { useDeleteArticleSection } from "~/api/mutations/admin/useDeleteArticleSection";
import { useDeleteArticleSectionLanguage } from "~/api/mutations/admin/useDeleteArticleSectionLanguage";
import { useUpdateArticleSection } from "~/api/mutations/admin/useUpdateArticleSection";
import { useArticleSection } from "~/api/queries/useArticleSection";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
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
  articleSectionFormSchema,
  type ArticleSectionFormValues,
} from "~/modules/Articles/articleSection.types";
import { LanguageSelector } from "~/modules/Articles/LanguageSelector";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { SupportedLanguages } from "@repo/shared";

type EditArticleSectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string;
};

export function EditArticleSectionSheet({
  open,
  onOpenChange,
  sectionId,
}: EditArticleSectionSheetProps) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();

  const [sectionLanguage, setSectionLanguage] = useState<SupportedLanguages>(language);

  const { data: section, isFetching } = useArticleSection(
    sectionId ?? "",
    open ? sectionLanguage : undefined,
  );

  const { mutateAsync: updateSection, isPending: isUpdating } = useUpdateArticleSection();
  const { mutateAsync: deleteSection, isPending: isDeleting } = useDeleteArticleSection();

  const { mutateAsync: addLanguage } = useAddArticleSectionLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteArticleSectionLanguage();

  const { handleSubmit, register, reset, formState } = useForm<ArticleSectionFormValues>({
    resolver: zodResolver(articleSectionFormSchema),
    defaultValues: { title: "" },
    mode: "onChange",
  });

  const { errors, isValid } = formState;

  useEffect(() => {
    if (!open) return;
    setSectionLanguage(language);
  }, [open, language]);

  useEffect(() => {
    if (!open) return;
    if (!section) return;

    if (!section.availableLocales.includes(sectionLanguage)) {
      setSectionLanguage(section.baseLanguage);
    }
  }, [open, section, sectionLanguage]);

  useEffect(() => {
    if (!open) return;
    reset({ title: section?.title ?? "" });
  }, [open, reset, section?.title]);

  if (!sectionId) return null;

  const onSubmit = async (values: ArticleSectionFormValues) => {
    await updateSection({ sectionId, language: sectionLanguage, title: values.title });
    onOpenChange(false);
  };

  const canDeleteSection = (section?.assignedArticlesCount ?? 0) === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[28rem] max-w-[92vw] sm:max-w-[32rem] p-0">
        <div className="flex h-dvh flex-col">
          <div className="border-b border-border p-6 pb-4">
            <SheetHeader className="space-y-1">
              <SheetTitle>{t("adminArticleView.section.editTitle")}</SheetTitle>
              <SheetDescription>{t("adminArticleView.section.editDescription")}</SheetDescription>
            </SheetHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
            <form
              id="edit-article-section-form"
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <Card>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label>{t("adminArticleView.section.languageLabel")}</Label>
                    <LanguageSelector
                      id={sectionId}
                      value={sectionLanguage}
                      baseLanguage={section?.baseLanguage}
                      availableLocales={section?.availableLocales}
                      onChange={setSectionLanguage}
                      onCreated={(lang) => setSectionLanguage(lang)}
                      onDeleted={() => {
                        setSectionLanguage(section?.baseLanguage ?? language);
                      }}
                      onCreate={async ({ id, language }) => {
                        await addLanguage({ id, language });
                      }}
                      onDelete={async ({ id, language }) => {
                        await deleteLanguage({ id, language });
                      }}
                    />
                    <div className="text-xs text-neutral-500">
                      {t("adminArticleView.section.languageHelp")}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="section-title">
                      <span className="mr-1 text-error-600">*</span>
                      {t("adminArticleView.section.fields.title")}
                    </Label>
                    <Input id="section-title" {...register("title")} />
                    {errors.title && (
                      <p className="text-sm text-destructive">
                        {t("adminArticleView.section.fields.titleError")}
                      </p>
                    )}
                  </div>
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
                      type="submit"
                      form="edit-article-section-form"
                      disabled={!isValid || isUpdating || isFetching || isDeleting}
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

                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!canDeleteSection || isUpdating || isDeleting}
                    onClick={async () => {
                      await deleteSection({ sectionId });
                      onOpenChange(false);
                    }}
                    className="w-fit ml-auto"
                  >
                    <Icon name="TrashIcon" className="mr-2 size-4" />
                    {t("common.button.delete")}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
