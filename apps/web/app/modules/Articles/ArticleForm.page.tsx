import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  ENTITY_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useAddArticleLanguage } from "~/api/mutations/admin/useAddArticleLanguage";
import { useDeleteArticleLanguage } from "~/api/mutations/admin/useDeleteArticleLanguage";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { usePreviewArticle } from "~/api/mutations/usePreviewArticle";
import { useUpdateArticle } from "~/api/mutations/useUpdateArticle";
import { useArticle } from "~/api/queries";
import { FormTextField } from "~/components/Form/FormTextField";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentEditor } from "~/components/RichText/Editor";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import { useVideoPlayer } from "~/components/VideoPlayer/VideoPlayerContext";
import {
  buildEntityResourceUrl,
  insertResourceIntoEditor,
  useEntityResourceUpload,
} from "~/hooks/useEntityResourceUpload";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { LanguageSelector } from "~/modules/Articles/LanguageSelector";
import { filterChangedData } from "~/utils/filterChangedData";

import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import type { Editor as TiptapEditor } from "@tiptap/react";
import type { InitVideoUploadResponse, UpdateArticleBody } from "~/api/generated-api";

type ArticleFormValues = {
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
};

type ArticleFormPageProps = {
  defaultValues?: Partial<ArticleFormValues>;
};

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  imageUrl: z.string(),
});

function ArticleFormPage({ defaultValues }: ArticleFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { articleId = "" } = useParams();
  const fileRef = useRef<File | null>(null);

  const [tabValue, setTabValue] = useState("editor");

  const { language: appLanguage } = useLanguageStore();

  const [articleLanguage, setArticleLanguage] = useState<SupportedLanguages>(appLanguage);

  const {
    data: existingArticle,
    isLoading: isLoadingArticle,
    isFetching: isFetchingArticle,
  } = useArticle(articleId ?? "", articleLanguage);
  const { mutateAsync: updateArticle } = useUpdateArticle();
  const { uploadResource } = useEntityResourceUpload();
  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { toast } = useToast();

  const { mutateAsync: addLanguage } = useAddArticleLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteArticleLanguage();

  const { mutateAsync: previewArticle, isPending: isPreviewLoading } = usePreviewArticle();
  const [previewContent, setPreviewContent] = useState("");
  const { getSessionForFile, uploadVideo, isUploading, uploadProgress } = useTusVideoUpload();

  const pageTitle = t("adminArticleView.form.editTitle");

  const breadcrumbs = [
    { title: t("navigationSideBar.articles"), href: "/articles" },
    { title: pageTitle, href: `/articles/${articleId}/edit` },
  ];

  const form = useForm<ArticleFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      summary: defaultValues?.summary ?? "",
      content: defaultValues?.content ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
    },
    resolver: zodResolver(schema),
  });
  const { reset } = form;

  const initialValuesRef = useRef<ArticleFormValues | null>(null);
  const lastResetKeyRef = useRef<string | null>(null);

  const { clearVideo } = useVideoPlayer();

  useEffect(() => {
    if (tabValue === "editor") {
      clearVideo();
    }
    return () => {
      clearVideo();
    };
  }, [clearVideo, tabValue]);

  useEffect(() => {
    if (!existingArticle || isFetchingArticle) return;

    const resetKey = `${articleId}:${articleLanguage}`;
    if (lastResetKeyRef.current !== resetKey) {
      const nextValues: ArticleFormValues = {
        title: existingArticle.title ?? "",
        summary: existingArticle.summary ?? "",
        content: existingArticle.plainContent ?? "",
        imageUrl: existingArticle.resources?.coverImage?.fileName ?? "",
      };

      reset(nextValues);
      initialValuesRef.current = nextValues;
      lastResetKeyRef.current = resetKey;
    }

    if (existingArticle.availableLocales.includes(articleLanguage)) return;

    if (existingArticle.availableLocales.includes(appLanguage)) {
      setArticleLanguage(appLanguage);
      return;
    }

    setArticleLanguage(existingArticle.baseLanguage);
  }, [appLanguage, articleId, articleLanguage, existingArticle, isFetchingArticle, reset]);

  const onSubmit = async (values: ArticleFormValues) => {
    if (!articleId || !articleLanguage) return;

    const formData = new FormData();
    formData.append("language", articleLanguage);

    const changedValues = filterChangedData<ArticleFormValues>(
      values,
      initialValuesRef.current ?? {},
    );

    if (changedValues.title) formData.append("title", changedValues.title);
    if (changedValues.summary) formData.append("summary", changedValues.summary);
    if (changedValues.content) formData.append("content", changedValues.content);

    if (fileRef.current) formData.append("cover", fileRef.current);

    await updateArticle({
      id: articleId,
      data: formData as unknown as UpdateArticleBody,
    });

    navigate(`/articles/${articleId}`);
  };

  const handleFileUpload = async (file?: File, editor?: TiptapEditor | null) => {
    if (!file || !articleId || !articleLanguage) return;

    const isVideo = ALLOWED_VIDEO_FILE_TYPES.includes(file.type);
    if (isVideo) {
      try {
        const session: InitVideoUploadResponse = await getSessionForFile({
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
            }),
        });

        await uploadVideo({ file, session });

        if (session.resourceId) {
          const resourceUrl = buildEntityResourceUrl(session.resourceId, "articles");

          editor
            ?.chain()
            .insertContent("<br />")
            .setVideoEmbed({
              src: resourceUrl,
              sourceType: session.provider === "s3" ? "external" : "internal",
            })
            .run();
        }
      } catch (error) {
        console.error("Error uploading video:", error);
        toast({
          description: t("uploadFile.toast.videoFailed"),
          variant: "destructive",
        });
      }
      return;
    }

    const isPresentation = ALLOWED_PRESENTATION_FILE_TYPES.includes(file.type);
    const isDocument =
      ALLOWED_EXCEL_FILE_TYPES.includes(file.type) ||
      ALLOWED_WORD_FILE_TYPES.includes(file.type) ||
      ALLOWED_PDF_FILE_TYPES.includes(file.type);

    const resourceId = await uploadResource({
      file,
      entityType: ENTITY_TYPES.ARTICLES,
      entityId: articleId,
      language: articleLanguage,
    });

    insertResourceIntoEditor({
      editor,
      resourceId,
      entityType: ENTITY_TYPES.ARTICLES,
      file,
      isPresentation,
      isDocument,
    });
  };

  const handleSaveHeaderImage = async (file: File) => {
    fileRef.current = file;
  };

  const fetchPreview = useCallback(
    async (contentValue: string) => {
      if (!articleId || !articleLanguage) {
        setPreviewContent(contentValue);
        return;
      }

      const parsedContent = await previewArticle({
        articleId,
        language: articleLanguage,
        content: contentValue,
      });
      setPreviewContent(parsedContent ?? contentValue);
    },
    [articleId, articleLanguage, previewArticle],
  );

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
    <PageWrapper breadcrumbs={breadcrumbs} className="bg-neutral-50/80">
      <div className="mx-auto w-full max-w-6xl mt-10">
        <div className="flex flex-col gap-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-100">
          <header className="flex flex-col gap-2 border-b border-neutral-200 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold leading-5 text-primary-600">
                    {t("navigationSideBar.articles")}
                  </p>
                  <h1 className="text-[32px] font-bold leading-[1.1] text-neutral-950">
                    {pageTitle}
                  </h1>
                </div>
                <LanguageSelector
                  id={articleId}
                  value={articleLanguage}
                  baseLanguage={existingArticle?.baseLanguage}
                  availableLocales={existingArticle?.availableLocales}
                  onChange={setArticleLanguage}
                  onCreated={(lang) => setArticleLanguage(lang)}
                  onCreate={async ({ id, language }) => {
                    await addLanguage({ id, language });
                  }}
                  onDelete={async ({ id, language }) => {
                    await deleteLanguage({ id, language });
                  }}
                />
              </div>
            </div>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title" className="flex items-center gap-1 text-neutral-900">
                    {t("adminArticleView.form.fields.title")}
                  </Label>
                  <FormTextField
                    control={form.control}
                    name="title"
                    placeholder={t("adminArticleView.form.placeholders.title")}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="summary" className="flex items-center gap-1 text-neutral-900">
                    {t("adminArticleView.form.fields.summary")}
                  </Label>
                  <FormTextField
                    control={form.control}
                    name="summary"
                    placeholder={t("adminArticleView.form.placeholders.summary")}
                  />
                </div>
              </div>

              <div className="w-full">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <Label htmlFor="media-upload" className="body-base-md text-neutral-900">
                        {t("adminArticleView.form.fields.cover")}
                      </Label>
                      <Input
                        id="media-upload"
                        type="file"
                        accept={[
                          ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                          ...ALLOWED_VIDEO_FILE_TYPES,
                        ].join(",")}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          handleSaveHeaderImage(file);
                          field.onChange(file.name);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-3">
                    <Label htmlFor="content" className="flex items-center gap-1 text-neutral-900">
                      {t("adminArticleView.form.fields.content")}
                    </Label>
                    <Tabs
                      value={tabValue}
                      onValueChange={(value) => {
                        setTabValue(value);
                        if (value === "preview") {
                          fetchPreview(field.value);
                        }
                      }}
                      className="flex flex-col gap-3"
                    >
                      <TabsList className="w-fit bg-primary-50">
                        <TabsTrigger value="editor">
                          {t("adminArticleView.form.editor")}
                        </TabsTrigger>
                        <TabsTrigger value="preview">
                          {t("adminArticleView.form.preview")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="editor">
                        <FormControl>
                          <div className="flex flex-col gap-y-1.5">
                            <ContentEditor
                              id="content"
                              content={field.value}
                              allowFiles
                              acceptedFileTypes={[
                                ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                                ...ALLOWED_VIDEO_FILE_TYPES,
                                ...ALLOWED_EXCEL_FILE_TYPES,
                                ...ALLOWED_PDF_FILE_TYPES,
                                ...ALLOWED_WORD_FILE_TYPES,
                                ...ALLOWED_PRESENTATION_FILE_TYPES,
                              ]}
                              onUpload={handleFileUpload}
                              uploadProgress={isUploading ? (uploadProgress ?? 0) : null}
                              onChange={field.onChange}
                            />
                            <FormMessage />
                          </div>
                        </FormControl>
                      </TabsContent>

                      <TabsContent value="preview">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-neutral-900 min-h-[200px]">
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

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-neutral-100"
                  onClick={() => {
                    navigate(-1);
                  }}
                >
                  {t("common.button.cancel")}
                </Button>
                <Button type="submit">{t("adminArticleView.form.saveButton")}</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </PageWrapper>
  );
}

export default ArticleFormPage;
