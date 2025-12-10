import { useNavigate, useParams } from "@remix-run/react";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { FormTextField } from "../../components/Form/FormTextField";
import Editor from "../../components/RichText/Editor";
import { Button } from "../../components/ui/button";
import { Form, FormControl, FormField, FormItem } from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

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

  const form = useForm<NewsFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      intro: defaultValues?.intro ?? "",
      content: defaultValues?.content ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
    },
  });

  const onSubmit = (values: NewsFormValues) => {
    // TODO: replace with API call to create/update news
    console.log("News payload (send to backend here):", {
      title: values.title,
      intro: values.intro,
      contentHtml: values.content,
      imageUrl: values.imageUrl,
      mode: isEdit ? "edit" : "create",
      newsId: isEdit ? newsId : undefined,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // TODO: upload file to backend, get a public URL, then insert that URL below.
    const tempUrl = URL.createObjectURL(file);
    form.setValue("imageUrl", tempUrl, { shouldValidate: true });
  };

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
              onChange={handleFileUpload}
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

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="content" className="body-base-md mt-6 text-neutral-950">
                  <span className="text-red-500">*</span> {t("newsView.field.content")}
                </Label>
                <FormControl>
                  <Editor
                    id="content"
                    lessonId="lessonId"
                    content={field.value}
                    className="h-48 w-full"
                    allowFiles
                    acceptedFileTypes={[
                      ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                      ...ALLOWED_VIDEO_FILE_TYPES,
                    ]}
                    {...field}
                  />
                </FormControl>
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
