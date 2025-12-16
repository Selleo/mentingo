import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
} from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-use";
import { z } from "zod";

import { usePreviewNews, useUpdateNews, useUploadNewsFile } from "../../api/mutations";
import { useNews } from "../../api/queries";
import { FormTextField } from "../../components/Form/FormTextField";
import { PageWrapper } from "../../components/PageWrapper";
import Editor from "../../components/RichText/Editor";
import Viewer from "../../components/RichText/Viever";
import { Button } from "../../components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "../../components/ui/form";
import { Input } from "../../components/ui/input";
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
import { baseUrl } from "../../utils/baseUrl";
import { filterChangedData } from "../../utils/filterChangedData";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import { NewsLanguageSelector } from "./components/NewsLanguageSelector";

import type { SupportedLanguages } from "@repo/shared";
import type { Editor as TipTapEditor } from "@tiptap/react";

type NewsFormValues = {
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  status: "draft" | "published";
  isPublic: boolean;
};

type UpdateNewsPayload = {
  language: "en" | "pl";
  title?: string;
  summary?: string;
  content?: string;
  status?: "draft" | "published";
  isPublic?: boolean;
  cover?: File;
};

type NewsFormPageProps = {
  defaultValues?: Partial<NewsFormValues>;
};

function NewsFormPage({ defaultValues }: NewsFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { newsId } = useParams();
  const location = useLocation();
  const createdNewsId = location.state?.usr?.createdNewsId;
  const isEdit = Boolean(newsId);
  const id = isEdit ? newsId : createdNewsId;
  const fileRef = useRef<File | null>(null);

  const [tabValue, setTabValue] = useState("editor");

  const { language, setLanguage } = useLanguageStore();
  const { data: existingNews, isLoading: isLoadingNews } = useNews(
    id,
    { language },
    { enabled: isEdit },
  );
  const { mutateAsync: updateNews } = useUpdateNews();
  const { mutateAsync: uploadNewsFile } = useUploadNewsFile();
  const { mutateAsync: previewNews, isPending: isPreviewLoading } = usePreviewNews();
  const [previewContent, setPreviewContent] = useState("");
  const pageTitle = isEdit ? t("newsView.button.edit") : t("newsView.createOrEdit");
  const breadcrumbs = [
    { title: t("navigationSideBar.dashboard"), href: "/" },
    { title: t("navigationSideBar.news"), href: "/news" },
    { title: pageTitle, href: isEdit && id ? `/news/${id}` : "/news/add" },
  ];

  const schema = useMemo(
    () =>
      z.object({
        title: z.string(),
        summary: z.string(),
        content: z.string(),
        imageUrl: z.string(),
        status: z.enum(["draft", "published"]),
        isPublic: z.boolean(),
      }),
    [],
  );

  const form = useForm<NewsFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      summary: defaultValues?.summary ?? "",
      content: defaultValues?.content ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
      status: defaultValues?.status ?? "draft",
      isPublic: defaultValues?.isPublic ?? false,
    },
    resolver: zodResolver(schema),
  });

  const { reset, getValues } = form;
  const initialValuesRef = useRef<NewsFormValues | null>(null);

  const onSubmit = async (values: NewsFormValues) => {
    if (!id) return;

    const formData = new FormData();
    formData.append("language", language);

    const changedValues = filterChangedData<NewsFormValues>(values, initialValuesRef.current ?? {});

    if (changedValues.title) formData.append("title", changedValues.title);
    if (changedValues.summary) formData.append("summary", changedValues.summary);
    if (changedValues.content) formData.append("content", changedValues.content);
    if (changedValues.status) formData.append("status", changedValues.status);
    if (changedValues.isPublic !== undefined)
      formData.append("isPublic", String(changedValues.isPublic));

    if (fileRef.current) {
      formData.append("cover", fileRef.current);
    }

    await updateNews({
      id,
      data: formData as unknown as UpdateNewsPayload,
    });

    navigate(`/news/${id}`);
  };

  const handleFileUpload = async (file?: File, editor?: TipTapEditor | null) => {
    if (!file || !id) return;

    await uploadNewsFile(
      {
        id,
        file,
        language,
        title: file.name,
        description: file.name,
      },
      {
        onSuccess: (data) => {
          const imageUrl = `${baseUrl}/api/news/resource/${data.data.resourceId}`;
          editor
            ?.chain()
            .insertContent("<br />")
            .insertContent(`<a href="${imageUrl}">${imageUrl}</a>`)
            .run();
        },
      },
    );
  };

  const handleSaveHeaderImage = async (file: File) => {
    fileRef.current = file;
  };

  useEffect(() => {
    if (!existingNews) return;

    const initialValues: NewsFormValues = {
      title: existingNews.title ?? "",
      summary: existingNews.summary ?? "",
      content: existingNews.plainContent ?? "",
      imageUrl: existingNews.resources?.images?.[0]?.fileUrl ?? "",
      status: (existingNews.status as "draft" | "published") ?? "draft",
      isPublic: existingNews.isPublic ?? false,
    };

    reset(initialValues);
    initialValuesRef.current = initialValues;
  }, [existingNews, reset]);

  useEffect(() => {
    if (initialValuesRef.current) return;
    initialValuesRef.current = getValues();
  }, [getValues]);

  const fetchPreview = useCallback(
    async (contentValue: string) => {
      if (!id) {
        setPreviewContent(contentValue);
        return;
      }

      const parsedContent = await previewNews({ newsId: id, language, content: contentValue });
      setPreviewContent(parsedContent ?? contentValue);
    },
    [id, language, previewNews],
  );

  if (isEdit && isLoadingNews) {
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
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold leading-5 text-primary-600">
                  {t("navigationSideBar.news")}
                </p>
                <h1 className="text-[32px] font-bold leading-[1.1] text-neutral-950">
                  {pageTitle}
                </h1>
              </div>
              {id && (
                <NewsLanguageSelector
                  newsId={id}
                  value={language}
                  baseLanguage={existingNews?.baseLanguage as SupportedLanguages}
                  availableLocales={existingNews?.availableLocales as SupportedLanguages[]}
                  onChange={(lang) => setLanguage(lang)}
                />
              )}
            </div>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title" className="flex items-center gap-1 text-neutral-900">
                    {t("newsView.field.title")}
                  </Label>
                  <FormTextField
                    control={form.control}
                    name="title"
                    placeholder={t("newsView.placeholder.title")}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <Label htmlFor="status" className="text-neutral-900">
                        {t("newsView.field.status")}
                      </Label>
                      <Select
                        value={field.value}
                        onValueChange={(val) => field.onChange(val as "draft" | "published")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">{t("newsView.status.draft")}</SelectItem>
                          <SelectItem value="published">
                            {t("newsView.status.published")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2 ">
                      <Label htmlFor="isPublic" className="text-neutral-900">
                        {t("newsView.field.isPublic")}
                      </Label>
                      <div className="flex items-center gap-3 rounded-xl h-[42px] py-2 px-3 border border-neutral-300">
                        <Switch
                          id="isPublic"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label={t("newsView.field.isPublic")}
                        />
                        <p className="text-sm text-neutral-700">
                          {t("newsView.isPublicDescription")}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-2">
                  <Label htmlFor="summary" className="flex items-center gap-1 text-neutral-900">
                    {t("newsView.field.summary")}
                  </Label>
                  <FormTextField
                    control={form.control}
                    name="summary"
                    placeholder={t("newsView.placeholder.summary")}
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
                        {t("newsView.field.image")}
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
                      {t("newsView.field.content")}
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
                        <TabsTrigger value="editor">Editor</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                      </TabsList>

                      <TabsContent value="editor">
                        <FormControl>
                          <div className="flex flex-col gap-y-1.5">
                            <Editor
                              id="content"
                              lessonId="lessonId"
                              content={field.value}
                              allowFiles
                              acceptedFileTypes={[
                                ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                                ...ALLOWED_VIDEO_FILE_TYPES,
                                ...ALLOWED_EXCEL_FILE_TYPES,
                                ...ALLOWED_PDF_FILE_TYPES,
                                ...ALLOWED_WORD_FILE_TYPES,
                              ]}
                              onUpload={handleFileUpload}
                              {...field}
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
                              style="prose"
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
                <Button type="submit">
                  {isEdit ? t("newsView.button.edit") : t("newsView.button.save")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </PageWrapper>
  );
}

export default NewsFormPage;
