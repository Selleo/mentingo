import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-use";
import { z } from "zod";

import { useUpdateNews, useUploadNewsFile } from "../../api/mutations";
import { useNews } from "../../api/queries";
import { FormTextField } from "../../components/Form/FormTextField";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { baseUrl } from "../../utils/baseUrl";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import type { Editor as TipTapEditor } from "@tiptap/react";

type NewsFormValues = {
  title: string;
  intro: string;
  content: string;
  imageUrl: string;
  status: "draft" | "published";
};

type UpdateNewsPayload = {
  language: "en" | "pl";
  title: string;
  summary: string;
  content: string;
  status: "draft" | "published";
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

  const { language } = useLanguageStore();
  const { data: existingNews, isLoading: isLoadingNews } = useNews(
    id,
    { language },
    { enabled: isEdit },
  );
  const { mutateAsync: updateNews } = useUpdateNews();
  const { mutateAsync: uploadNewsFile } = useUploadNewsFile();

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t("newsView.validation.titleRequired")),
        intro: z.string().min(1, t("newsView.validation.introRequired")),
        content: z.string().min(1, t("newsView.validation.contentRequired")),
        imageUrl: z.string().min(1, t("newsView.validation.imageRequired")),
        status: z.enum(["draft", "published"]),
      }),
    [t],
  );

  const form = useForm<NewsFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      intro: defaultValues?.intro ?? "",
      content: defaultValues?.content ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
      status: defaultValues?.status ?? "draft",
    },
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: NewsFormValues) => {
    console.log({ id });
    if (!id) return;

    const formData = new FormData();
    formData.append("language", language);
    formData.append("title", values.title);
    formData.append("summary", values.intro);
    formData.append("content", values.content);
    formData.append("status", values.status);

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
        title: "content-file-title",
        description: "content-file-desc",
      },
      {
        onSuccess: (data) => {
          console.log("data", data);
          // TODO: key TB change (check if it's proper string)
          const imageUrl = `${baseUrl}/api/news/news-image/${data.data.resourceId}`;
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

    form.reset({
      title: existingNews.title ?? "",
      intro: existingNews.summary ?? "",
      content: existingNews.content ?? "",
      imageUrl: existingNews.resources?.images?.[0]?.fileUrl ?? "",
      status: (existingNews.status as "draft" | "published") ?? "draft",
    });
  }, [existingNews, form]);

  if (isEdit && isLoadingNews) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
      <div className="h5 text-neutral-950">
        {isEdit ? t("newsView.button.edit") : t("newsView.createOrEdit")}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex items-center">
            <span className="mr-1 text-red-500">*</span>
            <Label htmlFor="title" className="mr-2">
              {t("newsView.field.title")}
            </Label>
          </div>
          <FormTextField
            control={form.control}
            name="title"
            placeholder={t("newsView.placeholder.title")}
          />

          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 mt-6">
                <Label htmlFor="media-upload" className="body-base-md text-neutral-950">
                  {t("newsView.field.image")}
                </Label>
                <Input
                  id="media-upload"
                  type="file"
                  accept={[...ALLOWED_LESSON_IMAGE_FILE_TYPES, ...ALLOWED_VIDEO_FILE_TYPES].join(
                    ",",
                  )}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    handleSaveHeaderImage(file);
                    field.onChange(file.name);
                  }}
                  required
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center mt-6">
            <span className="mr-1 text-red-500">*</span>
            <Label htmlFor="intro" className="mr-2">
              {t("newsView.field.intro")}
            </Label>
          </div>
          <FormTextField
            control={form.control}
            name="intro"
            placeholder={t("newsView.placeholder.intro")}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="mt-4">
                <Label htmlFor="status" className="mr-2">
                  {t("newsView.field.status")}
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(val) => field.onChange(val as "draft" | "published")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("newsView.status.draft")}</SelectItem>
                    <SelectItem value="published">{t("newsView.status.published")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* TODO: status field TBD */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="content" className="body-base-md mt-6 text-neutral-950">
                  <span className="text-red-500">*</span> {t("newsView.field.content")}
                </Label>
                <Tabs value={tabValue} onValueChange={(value) => setTabValue(value)}>
                  <TabsList className="bg-primary-50">
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
                          ]}
                          onUpload={handleFileUpload}
                          {...field}
                        />
                        <FormMessage />
                      </div>
                    </FormControl>
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="rounded-lg border border-neutral-200 p-4 text-neutral-900">
                      <Viewer
                        content={field.value || ""}
                        style="prose"
                        className="prose max-w-none"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </FormItem>
            )}
          />

          <div className="flex gap-x-3">
            <Button type="submit" className="mt-6">
              {isEdit ? t("newsView.button.edit") : t("newsView.button.save")}
            </Button>
            <Button
              type="button"
              className="mt-6 border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
              onClick={() => {
                navigate(-1);
              }}
            >
              {t("common.button.cancel")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default NewsFormPage;
