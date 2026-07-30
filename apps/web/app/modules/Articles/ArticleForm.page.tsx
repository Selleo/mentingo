import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ENTITY_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useDeleteArticleLanguage } from "~/api/mutations/admin/useDeleteArticleLanguage";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { usePreviewArticle } from "~/api/mutations/usePreviewArticle";
import { useUpdateArticle, type UpdateArticlePayload } from "~/api/mutations/useUpdateArticle";
import { useArticle } from "~/api/queries";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { FormTextField } from "~/components/Form/FormTextField";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentEditor } from "~/components/RichText/Editor";
import { RichTextUploadQueue } from "~/components/RichText/RichTextUploadQueue";
import Viewer from "~/components/RichText/Viever";
import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import {
  buildRichTextFileUploadHandler,
  RICH_TEXT_ACCEPTED_FILE_TYPES,
} from "~/hooks/buildRichTextFileUploadHandler";
import { useEntityResourceUpload } from "~/hooks/useEntityResourceUpload";
import { useRichTextUploadQueue } from "~/hooks/useRichTextUploadQueue";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useUploadDisplayModeDialog } from "~/hooks/useUploadDisplayModeDialog";

import { ARTICLE_FORM_PAGE_HANDLES } from "../../../e2e/data/articles/handles";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import {
  createArticleFormSchema,
  emptyArticleTranslation,
  type ArticleFormValues,
} from "./ArticleForm.schema";
import { ArticleLanguageSelector } from "./LanguageSelector";

import type { Editor as TiptapEditor } from "@tiptap/react";

function ArticleFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { articleId = "" } = useParams();
  const { language: initialLanguage } = useLanguageStore();
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguages>(initialLanguage);
  const [availableLocales, setAvailableLocales] = useState<SupportedLanguages[]>([]);
  const [baseLanguage, setBaseLanguage] = useState<SupportedLanguages>();
  const [tabValue, setTabValue] = useState("editor");
  const [coverPreview, setCoverPreview] = useState<string>();
  const [previewContent, setPreviewContent] = useState("");

  const {
    data: existingArticle,
    isLoading: isLoadingArticle,
    isFetching: isFetchingArticle,
  } = useArticle(articleId, activeLanguage, true);
  const { mutateAsync: updateArticle } = useUpdateArticle();
  const { mutateAsync: deleteArticleLanguage } = useDeleteArticleLanguage();
  const { mutateAsync: previewArticle, isPending: isPreviewLoading } = usePreviewArticle();
  const { uploadResource } = useEntityResourceUpload();
  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { toast } = useToast();
  const { getSessionForFile, uploadVideo } = useTusVideoUpload();
  const { items, enqueue, setStatus, setProgress, attachUploadId, clearFinished, remove } =
    useRichTextUploadQueue();
  const { askForDisplayMode, dialog: uploadDisplayModeDialog } = useUploadDisplayModeDialog();

  const schema = useMemo(
    () =>
      createArticleFormSchema(
        availableLocales,
        existingArticle?.availableLocales ?? [],
        t("adminArticleView.section.fields.titleError"),
      ),
    [availableLocales, existingArticle?.availableLocales, t],
  );

  const form = useForm<ArticleFormValues>({
    defaultValues: {
      translations: { [initialLanguage]: emptyArticleTranslation },
      isPublic: false,
    },
    resolver: zodResolver(schema) as never,
  });
  const { control, formState, getFieldState, resetField, setValue } = form;
  const activeCover = useWatch({
    control,
    name: `translations.${activeLanguage}.cover` as const,
  });

  useEffect(() => {
    if (!activeCover) {
      setCoverPreview(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(activeCover);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [activeCover]);

  useEffect(() => {
    if (!existingArticle || isFetchingArticle) return;

    setBaseLanguage(existingArticle.baseLanguage);
    setAvailableLocales((previous) => {
      const mergedLocales = [...new Set([...previous, ...existingArticle.availableLocales])];
      const isUnchanged =
        mergedLocales.length === previous.length &&
        mergedLocales.every((locale, index) => locale === previous[index]);

      return isUnchanged ? previous : mergedLocales;
    });

    const isPersistedLocale = existingArticle.availableLocales.includes(activeLanguage);
    const isStagedLocale = availableLocales.includes(activeLanguage);
    if (!isPersistedLocale && !isStagedLocale) {
      setActiveLanguage(existingArticle.baseLanguage);
      return;
    }

    const isLocaleDirty =
      getFieldState(`translations.${activeLanguage}.title` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.summary` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.content` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.cover` as const).isDirty;

    if (!isLocaleDirty) {
      resetField(`translations.${activeLanguage}.title` as const, {
        defaultValue: existingArticle.title ?? "",
      });
      resetField(`translations.${activeLanguage}.summary` as const, {
        defaultValue: existingArticle.summary ?? "",
      });
      resetField(`translations.${activeLanguage}.content` as const, {
        defaultValue: existingArticle.plainContent ?? "",
      });
    }

    if (!getFieldState("isPublic").isDirty) {
      resetField("isPublic", { defaultValue: existingArticle.isPublic ?? false });
    }
  }, [
    activeLanguage,
    availableLocales,
    existingArticle,
    getFieldState,
    isFetchingArticle,
    resetField,
  ]);

  const sharedFileUploadHandler = buildRichTextFileUploadHandler({
    entityType: ENTITY_TYPES.ARTICLES,
    getVideoSessionForFile: (file) =>
      getSessionForFile({
        file,
        init: () =>
          initVideoUpload({
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            title: file.name,
            resource: ENTITY_TYPES.ARTICLES,
            entityId: articleId,
            entityType: ENTITY_TYPES.ARTICLES,
            linkToEntity: false,
          }),
      }),
    uploadVideo,
    uploadResourceFile: (file) =>
      uploadResource({
        file,
        entityType: ENTITY_TYPES.ARTICLES,
        entityId: articleId,
        language: activeLanguage,
      }),
    askForDisplayMode,
    onVideoUploadError: () =>
      toast({ description: t("uploadFile.toast.videoFailed"), variant: "destructive" }),
    fallbackUploadErrorMessage: t("uploadFile.toast.videoFailed"),
    uploadQueue: { enqueue, setStatus, setProgress, attachUploadId, remove },
  });

  const handleFileUpload = async (file?: File, editor?: TiptapEditor | null) => {
    if (file) await sharedFileUploadHandler(file, editor);
  };

  const fetchPreview = useCallback(
    async (content: string) => {
      const parsedContent = await previewArticle({
        articleId,
        language: activeLanguage,
        content,
      });
      setPreviewContent(parsedContent ?? content);
    },
    [activeLanguage, articleId, previewArticle],
  );

  const changeLanguage = (language: SupportedLanguages) => {
    setActiveLanguage(language);
    setTabValue("editor");
  };

  const addLanguage = async (language: SupportedLanguages) => {
    setAvailableLocales((previous) => [...new Set([...previous, language])]);
    setValue(`translations.${language}` as const, emptyArticleTranslation, {
      shouldDirty: true,
    });
    changeLanguage(language);
  };

  const deleteLanguage = async (language: SupportedLanguages) => {
    if (existingArticle?.availableLocales.includes(language)) {
      await deleteArticleLanguage({ id: articleId, language });
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

  const persistedLocales = existingArticle?.availableLocales ?? [];
  const hasFormChanges =
    availableLocales.some(
      (language) => hasDirtyTranslation(language) || !persistedLocales.includes(language),
    ) || Boolean(formState.dirtyFields.isPublic);

  const saveArticle = async (values: ArticleFormValues) => {
    if (!articleId || items.length || !hasFormChanges) return;

    const translations = availableLocales
      .filter((language) => hasDirtyTranslation(language) || !persistedLocales.includes(language))
      .map((language) => ({ language, ...values.translations[language] }));
    const covers: Partial<Record<`cover.${SupportedLanguages}`, File>> = {};
    translations.forEach(({ language, cover }) => {
      if (cover) covers[`cover.${language}`] = cover;
    });
    const data: UpdateArticlePayload = {
      translations: JSON.stringify(
        translations.map(({ cover: _cover, ...translation }) => translation),
      ),
      ...(formState.dirtyFields.isPublic ? { isPublic: values.isPublic } : {}),
      ...covers,
    };

    await updateArticle({ id: articleId, data });
    navigate(`/articles/${articleId}`);
  };

  const invalidSubmit = (errors: typeof formState.errors) => {
    const invalidLanguage = availableLocales.find(
      (language) => errors.translations?.[language]?.title,
    );
    if (invalidLanguage) changeLanguage(invalidLanguage);
  };

  const pageTitle = t("adminArticleView.form.editTitle");
  const breadcrumbs = [
    { title: t("navigationSideBar.articles"), href: "/articles" },
    { title: pageTitle, href: `/articles/${articleId}/edit` },
  ];
  const coverImageUrl = coverPreview ?? existingArticle?.resources?.coverImage?.fileUrl;

  if (isLoadingArticle) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs} className="bg-neutral-50/80">
        <div className="flex items-center justify-center py-10">
          <Loader />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      breadcrumbs={breadcrumbs}
      className="bg-neutral-50/80"
      data-testid={ARTICLE_FORM_PAGE_HANDLES.PAGE}
    >
      <div className="mx-auto mt-10 w-full max-w-6xl">
        <div className="flex flex-col gap-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-100">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <p className="text-sm font-semibold text-primary-600">
                {t("navigationSideBar.articles")}
              </p>
              <h1 className="text-[32px] font-bold text-neutral-950">{pageTitle}</h1>
            </div>
            {baseLanguage && (
              <ArticleLanguageSelector
                formKey={`${articleId}-${availableLocales.join("-")}`}
                value={activeLanguage}
                baseLanguage={baseLanguage}
                availableLocales={availableLocales}
                onChange={changeLanguage}
                onCreateLanguage={addLanguage}
                onDeleteLanguage={deleteLanguage}
              />
            )}
          </header>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(saveArticle, invalidSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <div
                  key={`title-${activeLanguage}`}
                  className="flex flex-col gap-2.5 md:col-span-2"
                >
                  <Label>{t("adminArticleView.form.fields.title")}</Label>
                  <FormTextField
                    control={control}
                    name={`translations.${activeLanguage}.title` as const}
                    placeholder={t("adminArticleView.form.placeholders.title")}
                    data-testid={ARTICLE_FORM_PAGE_HANDLES.TITLE_INPUT}
                    className="h-11 bg-white text-base font-medium shadow-sm transition-shadow focus-visible:shadow-md"
                  />
                </div>

                <FormField
                  key={`summary-${activeLanguage}`}
                  control={control}
                  name={`translations.${activeLanguage}.summary` as const}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2.5 md:col-span-2">
                      <Label>{t("adminArticleView.form.fields.summary")}</Label>
                      <FormControl>
                        <AutosizeTextarea
                          {...field}
                          maxRows={8}
                          placeholder={t("adminArticleView.form.placeholders.summary")}
                          data-testid={ARTICLE_FORM_PAGE_HANDLES.SUMMARY_INPUT}
                          className="min-h-24 resize-none bg-white shadow-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex w-full items-center justify-between gap-6 border-y border-neutral-200 py-5">
                        <div className="flex min-w-0 flex-col gap-1">
                          <Label>{t("adminArticleView.form.fields.isPublic")}</Label>
                          <p className="text-sm text-neutral-700">
                            {t("adminArticleView.form.isPublicDescription")}
                          </p>
                        </div>
                        <Switch
                          className="shrink-0"
                          data-testid={ARTICLE_FORM_PAGE_HANDLES.IS_PUBLIC_SWITCH}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                key={`cover-${activeLanguage}`}
                control={control}
                name={`translations.${activeLanguage}.cover` as const}
                render={({ field }) => (
                  <FormItem className="max-w-xl">
                    <Label className="mb-2 block">{t("adminArticleView.form.fields.cover")}</Label>
                    <ImageUploadInput
                      field={{ value: coverImageUrl }}
                      imageUrl={coverImageUrl}
                      inputId="article-cover"
                      variant="video"
                      accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
                      isUploading={false}
                      handleImageUpload={field.onChange}
                    />
                  </FormItem>
                )}
              />

              <FormField
                key={`content-${activeLanguage}`}
                control={control}
                name={`translations.${activeLanguage}.content` as const}
                render={({ field }) => (
                  <FormItem>
                    <Label>{t("adminArticleView.form.fields.content")}</Label>
                    <Tabs
                      value={tabValue}
                      onValueChange={(value) => {
                        setTabValue(value);
                        if (value === "preview") void fetchPreview(field.value);
                      }}
                      className="mt-2 flex flex-col gap-0"
                    >
                      <TabsList className="sticky top-0 z-10 grid h-11 w-full grid-cols-2 rounded-b-none rounded-t-lg border border-neutral-300 bg-primary-50 p-0 shadow-sm">
                        <TabsTrigger
                          value="editor"
                          data-testid={ARTICLE_FORM_PAGE_HANDLES.CONTENT_EDITOR_TAB}
                          className="h-full w-full rounded-none rounded-tl-lg border-r border-neutral-300 data-[state=active]:shadow-none"
                        >
                          {t("adminArticleView.form.editor")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="preview"
                          data-testid={ARTICLE_FORM_PAGE_HANDLES.CONTENT_PREVIEW_TAB}
                          className="h-full w-full rounded-none rounded-tr-lg data-[state=active]:shadow-none"
                        >
                          {t("adminArticleView.form.preview")}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="editor" className="mt-0">
                        <FormControl>
                          <div>
                            <ContentEditor
                              id="content"
                              content={field.value}
                              parentClassName="-mt-px rounded-t-none after:rounded-t-none"
                              allowFiles
                              acceptedFileTypes={RICH_TEXT_ACCEPTED_FILE_TYPES}
                              onUpload={handleFileUpload}
                              assetLibrary={{
                                entityType: ENTITY_TYPES.ARTICLES,
                                entityId: articleId,
                                language: activeLanguage,
                              }}
                              onChange={field.onChange}
                            />
                            <RichTextUploadQueue
                              items={items}
                              onClearFinished={clearFinished}
                              onRemoveItem={remove}
                            />
                            <FormMessage />
                          </div>
                        </FormControl>
                      </TabsContent>
                      <TabsContent value="preview" className="mt-0">
                        <div className="-mt-px min-h-[200px] rounded-b-lg rounded-t-none border border-neutral-300 bg-neutral-50/80 p-4 text-neutral-900">
                          {isPreviewLoading ? (
                            <div className="flex h-full items-center justify-center py-8">
                              <Loader />
                            </div>
                          ) : (
                            <Viewer
                              content={previewContent}
                              variant="article"
                              className="prose max-w-none"
                            />
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  data-testid={ARTICLE_FORM_PAGE_HANDLES.CANCEL_BUTTON}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(-1)}
                >
                  {t("common.button.cancel")}
                </Button>
                <Button
                  data-testid={ARTICLE_FORM_PAGE_HANDLES.SAVE_BUTTON}
                  type="submit"
                  disabled={items.length > 0 || !hasFormChanges}
                >
                  {t("adminArticleView.form.saveButton")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      {uploadDisplayModeDialog}
    </PageWrapper>
  );
}

export default ArticleFormPage;
