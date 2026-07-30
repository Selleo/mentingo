import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ENTITY_TYPES,
  NEWS_STATUS,
  type SupportedLanguages,
} from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-use";

import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useToast } from "~/components/ui/use-toast";
import {
  buildRichTextFileUploadHandler,
  RICH_TEXT_ACCEPTED_FILE_TYPES,
} from "~/hooks/buildRichTextFileUploadHandler";
import { useEntityResourceUpload } from "~/hooks/useEntityResourceUpload";
import { useRichTextUploadQueue } from "~/hooks/useRichTextUploadQueue";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useUploadDisplayModeDialog } from "~/hooks/useUploadDisplayModeDialog";

import { NEWS_FORM_PAGE_HANDLES } from "../../../e2e/data/news/handles";
import { useDeleteNewsLanguage, useUpdateNews } from "../../api/mutations";
import { useNews } from "../../api/queries";
import ImageUploadInput from "../../components/FileUploadInput/ImageUploadInput";
import { FormTextField } from "../../components/Form/FormTextField";
import { PageWrapper } from "../../components/PageWrapper";
import { ContentEditor } from "../../components/RichText/Editor";
import { RichTextUploadQueue } from "../../components/RichText/RichTextUploadQueue";
import Viewer from "../../components/RichText/Viever";
import { AutosizeTextarea } from "../../components/ui/autosize-textarea";
import { Button } from "../../components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "../../components/ui/form";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import { NewsLanguageSelector } from "./components/NewsLanguageSelector";
import { createNewsFormSchema } from "./NewsForm.schema";

import type { NewsFormValues, TranslationValues } from "./NewsForm.schema";
import type { Editor as TipTapEditor } from "@tiptap/react";

const emptyTranslation: TranslationValues = { title: "", summary: "", content: "" };

function NewsFormPage() {
  const { t } = useTranslation();
  const { newsId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const createdNewsId = location.state?.usr?.createdNewsId as string | undefined;
  const id = newsId ?? createdNewsId;

  const isEdit = Boolean(newsId);

  const { language: initialLanguage } = useLanguageStore();
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguages>(initialLanguage);
  const [availableLocales, setAvailableLocales] = useState<SupportedLanguages[]>([initialLanguage]);
  const [baseLanguage, setBaseLanguage] = useState<SupportedLanguages>();
  const [tabValue, setTabValue] = useState("editor");
  const [coverPreview, setCoverPreview] = useState<string>();

  const {
    data: existingNews,
    isLoading: isLoadingNews,
    isFetching: isFetchingNews,
  } = useNews(id ?? "", { language: activeLanguage }, { enabled: Boolean(id) });

  const formSchema = useMemo(
    () =>
      createNewsFormSchema(
        availableLocales,
        existingNews?.availableLocales ?? [],
        t("newsView.validation.titleRequired"),
      ),
    [availableLocales, existingNews?.availableLocales, t],
  );

  const form = useForm<NewsFormValues>({
    defaultValues: {
      translations: { [initialLanguage]: emptyTranslation },
      status: (existingNews?.status as NewsFormValues["status"]) ?? NEWS_STATUS.DRAFT,
      isPublic: existingNews?.isPublic ?? false,
    },
    resolver: zodResolver(formSchema) as never,
  });

  const { control, formState, getFieldState, resetField, setValue } = form;

  const activeCover = useWatch({
    control,
    name: `translations.${activeLanguage}.cover` as const,
  });

  const { mutateAsync: updateNews } = useUpdateNews();
  const { mutateAsync: deleteNewsLanguage } = useDeleteNewsLanguage();

  const { uploadResource } = useEntityResourceUpload();
  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { getSessionForFile, uploadVideo } = useTusVideoUpload();
  const { items, enqueue, setStatus, setProgress, attachUploadId, clearFinished, remove } =
    useRichTextUploadQueue();
  const { askForDisplayMode, dialog: uploadDisplayModeDialog } = useUploadDisplayModeDialog();

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
    if (!existingNews || isFetchingNews) return;

    setBaseLanguage(existingNews.baseLanguage);
    setAvailableLocales((previous) => [
      ...new Set([...previous, ...existingNews.availableLocales]),
    ]);

    if (!existingNews.availableLocales.includes(activeLanguage)) return;
    const isLocaleDirty =
      getFieldState(`translations.${activeLanguage}.title` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.summary` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.content` as const).isDirty ||
      getFieldState(`translations.${activeLanguage}.cover` as const).isDirty;

    if (!isLocaleDirty) {
      resetField(`translations.${activeLanguage}.title` as const, {
        defaultValue: existingNews.title ?? "",
      });
      resetField(`translations.${activeLanguage}.summary` as const, {
        defaultValue: existingNews.summary ?? "",
      });
      resetField(`translations.${activeLanguage}.content` as const, {
        defaultValue: existingNews.plainContent ?? "",
      });
    }

    if (!getFieldState("status").isDirty) {
      resetField("status", {
        defaultValue: (existingNews.status as NewsFormValues["status"]) ?? NEWS_STATUS.DRAFT,
      });
    }

    if (!getFieldState("isPublic").isDirty) {
      resetField("isPublic", { defaultValue: existingNews.isPublic ?? false });
    }
  }, [activeLanguage, existingNews, getFieldState, isFetchingNews, resetField]);

  const changeLanguage = (language: SupportedLanguages) => {
    setActiveLanguage(language);
    setTabValue("editor");
  };

  const addLanguage = async (language: SupportedLanguages) => {
    setAvailableLocales((previous) => [...new Set([...previous, language])]);
    setValue(`translations.${language}` as const, emptyTranslation, { shouldDirty: true });
  };

  const deleteLanguage = async (language: SupportedLanguages) => {
    if (existingNews?.availableLocales.includes(language) && id) {
      await deleteNewsLanguage({ id, language });
    }
    setAvailableLocales((previous) => previous.filter((locale) => locale !== language));
    form.unregister(`translations.${language}` as const);
    resetField(`translations.${language}` as const);
  };

  const sharedFileUploadHandler = buildRichTextFileUploadHandler({
    entityType: ENTITY_TYPES.NEWS,
    getVideoSessionForFile: (file) =>
      getSessionForFile({
        file,
        init: () =>
          initVideoUpload({
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            title: file.name,
            resource: ENTITY_TYPES.NEWS,
            entityId: id,
            entityType: ENTITY_TYPES.NEWS,
            linkToEntity: false,
          }),
      }),
    uploadVideo,
    uploadResourceFile: (file) =>
      uploadResource({
        file,
        entityType: ENTITY_TYPES.NEWS,
        entityId: id,
        language: activeLanguage,
      }),
    askForDisplayMode,
    onVideoUploadError: () =>
      toast({ description: t("uploadFile.toast.videoFailed"), variant: "destructive" }),
    fallbackUploadErrorMessage: t("uploadFile.toast.videoFailed"),
    uploadQueue: { enqueue, setStatus, setProgress, attachUploadId, remove },
  });

  const hasDirtyTranslation = (language: SupportedLanguages) => {
    const dirtyTranslation = formState.dirtyFields.translations?.[language];
    if (!dirtyTranslation) return false;
    if (typeof dirtyTranslation === "boolean") return dirtyTranslation;
    return Object.values(dirtyTranslation).some(Boolean);
  };

  const persistedLocales = existingNews?.availableLocales ?? [];

  const hasFormChanges =
    availableLocales.some(
      (language) => hasDirtyTranslation(language) || !persistedLocales.includes(language),
    ) ||
    Boolean(formState.dirtyFields.status) ||
    Boolean(formState.dirtyFields.isPublic);

  const saveNews = async (values: NewsFormValues) => {
    if (!id || items.length || !hasFormChanges) return;

    const translations = availableLocales
      .filter((language) => hasDirtyTranslation(language) || !persistedLocales.includes(language))
      .map((language) => ({ language, ...values.translations[language] }));

    const formData = new FormData();

    formData.append(
      "translations",
      JSON.stringify(translations.map(({ cover: _cover, ...draft }) => draft)),
    );

    if (formState.dirtyFields.status) formData.append("status", values.status);
    if (formState.dirtyFields.isPublic) formData.append("isPublic", String(values.isPublic));

    translations.forEach(({ language, cover }) => {
      if (cover) formData.append(`cover.${language}`, cover);
    });

    await updateNews({ id, data: formData as never });
    navigate(`/news/${id}`);
  };

  const invalidSubmit = (errors: typeof formState.errors) => {
    const invalidLanguage = availableLocales.find(
      (language) => errors.translations?.[language]?.title,
    );

    if (invalidLanguage) changeLanguage(invalidLanguage);
  };

  const pageTitle = isEdit ? t("newsView.edit") : t("newsView.create");

  const breadcrumbs = [
    { title: t("navigationSideBar.news"), href: "/news" },
    { title: pageTitle, href: id ? `/news/${id}` : "/news/add" },
  ];

  const coverImageUrl = coverPreview ?? existingNews?.resources?.coverImage?.fileUrl;

  if (isEdit && isLoadingNews) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      breadcrumbs={breadcrumbs}
      className="bg-neutral-50/80"
      data-testid={NEWS_FORM_PAGE_HANDLES.PAGE}
    >
      <div className="mx-auto mt-10 w-full max-w-6xl">
        <div className="flex flex-col gap-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-100">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <p className="text-sm font-semibold text-primary-600">
                {t("navigationSideBar.news")}
              </p>
              <h1 className="text-[32px] font-bold text-neutral-950">{pageTitle}</h1>
            </div>
            {id && (
              <NewsLanguageSelector
                formKey={`${id}-${availableLocales.join("-")}`}
                newsId={id}
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
              onSubmit={form.handleSubmit(saveNews, invalidSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <div key={`title-${activeLanguage}`} className="flex flex-col gap-2.5">
                  <Label>{t("newsView.field.title")}</Label>
                  <FormTextField
                    control={control}
                    name={`translations.${activeLanguage}.title` as const}
                    placeholder={t("newsView.placeholder.title")}
                    data-testid={NEWS_FORM_PAGE_HANDLES.TITLE_INPUT}
                    className="h-11 bg-white text-base font-medium shadow-sm transition-shadow focus-visible:shadow-md"
                  />
                </div>
                <FormField
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2.5">
                      <Label>{t("newsView.field.status")}</Label>
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value as NewsFormValues["status"])}
                      >
                        <SelectTrigger
                          data-testid={NEWS_FORM_PAGE_HANDLES.STATUS_SELECT}
                          className="h-11 bg-white font-medium shadow-sm transition-shadow focus:shadow-md"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value={NEWS_STATUS.DRAFT}
                            data-testid={NEWS_FORM_PAGE_HANDLES.statusOption(NEWS_STATUS.DRAFT)}
                          >
                            {t("newsView.status.draft")}
                          </SelectItem>
                          <SelectItem
                            value={NEWS_STATUS.PUBLISHED}
                            data-testid={NEWS_FORM_PAGE_HANDLES.statusOption(NEWS_STATUS.PUBLISHED)}
                          >
                            {t("newsView.status.published")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  key={`summary-${activeLanguage}`}
                  control={control}
                  name={`translations.${activeLanguage}.summary` as const}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2.5 md:col-span-2">
                      <Label>{t("newsView.field.summary")}</Label>
                      <FormControl>
                        <AutosizeTextarea
                          {...field}
                          maxRows={8}
                          placeholder={t("newsView.placeholder.summary")}
                          data-testid={NEWS_FORM_PAGE_HANDLES.SUMMARY_INPUT}
                          className="min-h-24 resize-none bg-white shadow-sm transition-shadow focus-visible:shadow-md"
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
                          <Label>{t("newsView.field.isPublic")}</Label>
                          <p className="text-sm text-neutral-700">
                            {t("newsView.isPublicDescription")}
                          </p>
                        </div>
                        <Switch
                          className="shrink-0"
                          data-testid={NEWS_FORM_PAGE_HANDLES.IS_PUBLIC_SWITCH}
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
                    <Label className="mb-2 block">{t("newsView.field.image")}</Label>
                    <ImageUploadInput
                      field={{ value: coverImageUrl }}
                      imageUrl={coverImageUrl}
                      inputId="news-cover"
                      variant="video"
                      accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
                      isUploading={false}
                      handleImageUpload={(file) => field.onChange(file)}
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
                    <Label>{t("newsView.field.content")}</Label>
                    <Tabs
                      value={tabValue}
                      onValueChange={setTabValue}
                      className="mt-2 flex flex-col gap-0"
                    >
                      <TabsList className="sticky top-0 z-10 grid h-11 w-full grid-cols-2 rounded-b-none rounded-t-lg border border-neutral-300 bg-primary-50 p-0 shadow-sm">
                        <TabsTrigger
                          value="editor"
                          data-testid={NEWS_FORM_PAGE_HANDLES.CONTENT_EDITOR_TAB}
                          className="h-full w-full rounded-none rounded-tl-lg border-r border-neutral-300 data-[state=active]:shadow-none"
                        >
                          {t("newsView.editor")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="preview"
                          data-testid={NEWS_FORM_PAGE_HANDLES.CONTENT_PREVIEW_TAB}
                          className="h-full w-full rounded-none rounded-tr-lg data-[state=active]:shadow-none"
                        >
                          {t("newsView.preview")}
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
                              onUpload={async (file?: File, editor?: TipTapEditor | null) => {
                                if (file && id) await sharedFileUploadHandler(file, editor);
                              }}
                              assetLibrary={{
                                entityType: ENTITY_TYPES.NEWS,
                                entityId: id,
                                language: activeLanguage,
                              }}
                              {...field}
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
                          <Viewer
                            content={field.value}
                            variant={ENTITY_TYPES.NEWS}
                            className="prose max-w-none"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  data-testid={NEWS_FORM_PAGE_HANDLES.CANCEL_BUTTON}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!formState.isDirty || window.confirm(t("common.button.cancel")))
                      navigate(-1);
                  }}
                >
                  {t("common.button.cancel")}
                </Button>
                <Button
                  data-testid={NEWS_FORM_PAGE_HANDLES.SAVE_BUTTON}
                  type="submit"
                  disabled={items.length > 0 || !hasFormChanges}
                >
                  {t("common.button.save")}
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

export default NewsFormPage;
