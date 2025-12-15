import { useNavigate, useParams } from "@remix-run/react";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateNews, useUpdateNews, useUploadNewsFile } from "../../api/mutations";
import { useNews } from "../../api/queries";
import { FormTextField } from "../../components/Form/FormTextField";
import Editor from "../../components/RichText/Editor";
import Viewer from "../../components/RichText/Viever";
import { Button } from "../../components/ui/button";
import { Form, FormControl, FormField, FormItem } from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
};

type NewsFormPageProps = {
  defaultValues?: Partial<NewsFormValues>;
};

function NewsFormPage({ defaultValues }: NewsFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { newsId } = useParams();
  const isEdit = Boolean(newsId);
  const fileRef = useRef<File | null>(null);
  const persistedNewsIdRef = useRef<string>(newsId ?? "");

  const [tabValue, setTabValue] = useState("editor");

  const { language } = useLanguageStore();
  const { data: existingNews, isLoading: isLoadingNews } = useNews(
    persistedNewsIdRef.current,
    { language },
    { enabled: isEdit },
  );
  const { mutateAsync: createNews } = useCreateNews();
  const { mutateAsync: updateNews } = useUpdateNews();
  const { mutateAsync: uploadNewsFile } = useUploadNewsFile();

  const form = useForm<NewsFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      intro: defaultValues?.intro ?? "",
      content: defaultValues?.content ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
    },
  });

  const onSubmit = async (values: NewsFormValues) => {
    let targetId = persistedNewsIdRef.current || newsId;

    if (!targetId) {
      const created = await createNews({ language });
      targetId = created.data.id;
      persistedNewsIdRef.current = targetId;
    }

    if (!targetId) return;

    const basePayload = {
      language,
      title: values.title,
      summary: values.intro,
      content: values.content,
      status: "published" as const,
      isPublic: true,
    };

    if (fileRef.current) {
      const formData = new FormData();
      Object.entries(basePayload).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      formData.append("cover", fileRef.current);

      await updateNews({
        id: targetId,
        data: formData as unknown as typeof basePayload,
      });
    } else {
      await updateNews({
        id: targetId,
        data: basePayload,
      });
    }

    navigate(`/news/${targetId}`);
  };

  const handleFileUpload = async (file?: File, editor?: TipTapEditor | null) => {
    if (!file) return;
    let targetNewsId = persistedNewsIdRef.current || newsId;

    if (!targetNewsId) {
      const newNews = await createNews({ language });
      targetNewsId = newNews.data.id;
      persistedNewsIdRef.current = targetNewsId;
    }

    if (!targetNewsId) return;

    await uploadNewsFile(
      {
        id: targetNewsId,
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

          <div className="flex flex-col gap-2 mt-6">
            <Label htmlFor="media-upload" className="body-base-md text-neutral-950">
              {t("newsView.field.image")}
            </Label>
            <Input
              id="media-upload"
              type="file"
              accept={[...ALLOWED_LESSON_IMAGE_FILE_TYPES, ...ALLOWED_VIDEO_FILE_TYPES].join(",")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                handleSaveHeaderImage(file);
              }}
            />
          </div>

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
