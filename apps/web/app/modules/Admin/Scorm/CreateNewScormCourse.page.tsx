import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateScormCourse } from "~/api/mutations/useCreateScormCourse";
import { useCategoriesSuspense } from "~/api/queries/useCategories";
import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { CourseDescriptionLimitMessage } from "~/modules/Admin/AddCourse/components/CourseDescriptionLimitMessage";
import { CourseMetadataFields } from "~/modules/Admin/AddCourse/components/CourseMetadataFields";
import { CourseThumbnailUploadField } from "~/modules/Admin/AddCourse/components/CourseThumbnailUploadField";
import { useObjectUrl } from "~/modules/Admin/AddCourse/hooks/useObjectUrl";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isBrowserFile } from "~/utils/isBrowserFile";
import { setPageTitle } from "~/utils/setPageTitle";

import Breadcrumb from "../AddCourse/components/Breadcrumb";

import { ScormPackageUploadField } from "./components/ScormPackageUploadField";
import { scormCourseFormSchema } from "./validators/scormCourseFormSchema";

import type { ScormCourseFormValues } from "./validators/scormCourseFormSchema";
import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

const CreateNewScormCourse = () => {
  const { data: categories } = useCategoriesSuspense();
  const { language } = useLanguageStore();
  const { t } = useTranslation();
  const { mutateAsync: createScormCourse, isPending: isCreatingScormCourse } =
    useCreateScormCourse();
  const navigate = useNavigate();
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ScormCourseFormValues>({
    resolver: zodResolver(scormCourseFormSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      categoryId: "",
      language,
      thumbnailFile: undefined,
      scormFile: undefined,
    },
  });

  const scormFile = form.watch("scormFile");
  const thumbnailFile = form.watch("thumbnailFile");
  const description = form.watch("description");
  const thumbnailPreviewUrl = useObjectUrl(thumbnailFile);

  const removeThumbnail = () => {
    form.setValue("thumbnailFile", undefined, { shouldDirty: true, shouldValidate: true });
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  const onSubmit = async (values: ScormCourseFormValues) => {
    if (!isBrowserFile(values.scormFile)) return;

    const response = await createScormCourse({
      data: {
        title: values.title,
        description: values.description,
        categoryId: values.categoryId,
        language: values.language,
        scormPackage: values.scormFile,
        thumbnail: isBrowserFile(values.thumbnailFile) ? values.thumbnailFile : undefined,
        status: "draft",
      },
    });

    navigate(`/admin/beta-courses/${response.data.id}`);
  };

  return (
    <div className="flex h-screen overflow-auto bg-white px-20 py-8">
      <div className="flex w-full items-center justify-center">
        <img src={SplashScreenImage} alt="splashScreenImage" className="rounded" />
      </div>
      <div className="flex w-full max-w-[820px] flex-col gap-y-6 px-8">
        <Breadcrumb
          backTo="/admin/beta-courses/new"
          currentLabel={t("adminCourseTypeSelector.scorm.title")}
        />
        <hgroup className="gapy-y-1 flex flex-col">
          <p className="body-base-md text-emerald-700">{t("adminScorm.create.eyebrow")}</p>
          <h1 className="h3 text-neutral-950">{t("adminScorm.create.title")}</h1>
          <p className="body-lg-md text-neutral-800">{t("adminScorm.create.subtitle")}</p>
        </hgroup>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="mt-2">
              <Label className="body-base-md">
                <span className="text-red-500">*</span> {t("adminScorm.create.packageSection")}
              </Label>
              <p className="body-sm mb-3 mt-1 text-neutral-700">
                {t("adminScorm.create.packageSectionDescription")}
              </p>
              <FormField
                control={form.control}
                name="scormFile"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <ScormPackageUploadField
                        file={isBrowserFile(field.value) ? field.value : undefined}
                        error={fieldState.error?.message}
                        onChange={(file) => field.onChange(file)}
                        onClear={() => field.onChange(undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-5">
              <CourseMetadataFields
                control={form.control}
                setValue={form.setValue}
                categories={categories}
              />
            </div>
            <CourseDescriptionLimitMessage
              description={description ?? ""}
              charactersLeftLabel={t("adminCourseView.settings.other.charactersLeft")}
              reachedCharactersLimitLabel={t(
                "adminCourseView.settings.other.reachedCharactersLimit",
              )}
              reachedCharactersLimitHtmlLabel={t(
                "adminCourseView.settings.other.reachedCharactersLimitHtml",
              )}
            />

            <FormField
              control={form.control}
              name="thumbnailFile"
              render={({ field }) => (
                <FormItem className="mt-5">
                  <Label htmlFor="thumbnailFile" className="body-base-md">
                    {t("adminCourseView.settings.field.thumbnail")}
                  </Label>
                  <FormControl>
                    <CourseThumbnailUploadField
                      inputId="thumbnailFile"
                      inputRef={thumbnailInputRef}
                      imageUrl={thumbnailPreviewUrl}
                      onFileSelect={field.onChange}
                      onClear={removeThumbnail}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pb-5">
              <div className="mb-10 mt-5 flex space-x-5">
                <Button
                  type="button"
                  className="rounded border-2 bg-white px-6 py-2 text-primary-800"
                  asChild
                >
                  <Link to="/admin/beta-courses/new">{t("common.button.cancel")}</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || !scormFile || isCreatingScormCourse}
                >
                  {isCreatingScormCourse
                    ? t("adminScorm.create.creating")
                    : t("adminScorm.create.submit")}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default CreateNewScormCourse;
