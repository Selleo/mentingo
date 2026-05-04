import { useNavigate } from "@remix-run/react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import { useCategoriesSuspense } from "~/api/queries/useCategories";
import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { setPageTitle } from "~/utils/setPageTitle";

import { CREATE_COURSE_PAGE_HANDLES } from "../../../../e2e/data/courses/handles";

import Breadcrumb from "./components/Breadcrumb";
import { CourseDescriptionLimitMessage } from "./components/CourseDescriptionLimitMessage";
import { CourseMetadataFields } from "./components/CourseMetadataFields";
import { CourseThumbnailUploadField } from "./components/CourseThumbnailUploadField";
import { useAddCourseForm } from "./hooks/useAddCourseForm";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

const AddCourse = () => {
  const { form, onSubmit } = useAddCourseForm();
  const { data: categories } = useCategoriesSuspense();
  const [isUploading, setIsUploading] = useState(false);
  const { mutateAsync: uploadFile } = useUploadFile();
  const { isValid: isFormValid } = form.formState;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayThumbnailUrl, setDisplayThumbnailUrl] = useState<string | undefined>(undefined);

  const watchedDescription = form.watch("description");

  const handleImageUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const result = await uploadFile({ file, resource: "course" });
        form.setValue("thumbnailS3Key", result.fileKey, { shouldValidate: true });
        setDisplayThumbnailUrl(result.fileUrl);
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [form, uploadFile],
  );

  const removeThumbnail = () => {
    form.setValue("thumbnailS3Key", "");
    setDisplayThumbnailUrl(undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      data-testid={CREATE_COURSE_PAGE_HANDLES.PAGE}
      className="flex h-screen overflow-auto bg-white px-20 py-8"
    >
      <div className="flex w-full items-center justify-center">
        <img src={SplashScreenImage} alt="splashScreenImage" className="rounded" />
      </div>
      <div className="flex w-full max-w-[820px] flex-col gap-y-6 px-8">
        <Breadcrumb
          backTo="/admin/beta-courses/new"
          currentLabel={t("adminCourseTypeSelector.standard.title")}
        />
        <hgroup className="gapy-y-1 flex flex-col">
          <h1 data-testid={CREATE_COURSE_PAGE_HANDLES.HEADING} className="h3 text-neutral-950">
            {t("adminCourseView.settings.header")}
          </h1>
          <p className="body-lg-md text-neutral-800">{t("adminCourseView.settings.subHeader")}</p>
        </hgroup>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CourseMetadataFields
              control={form.control}
              setValue={form.setValue}
              categories={categories}
              showBaseLanguageTooltip
              testIds={{
                titleInput: CREATE_COURSE_PAGE_HANDLES.TITLE_INPUT,
                categorySelect: CREATE_COURSE_PAGE_HANDLES.CATEGORY_SELECT,
                categoryOption: CREATE_COURSE_PAGE_HANDLES.categoryOption,
                languageSelect: CREATE_COURSE_PAGE_HANDLES.LANGUAGE_SELECT,
                languageOption: CREATE_COURSE_PAGE_HANDLES.languageOption,
                descriptionEditor: CREATE_COURSE_PAGE_HANDLES.DESCRIPTION_EDITOR,
              }}
            />
            <CourseDescriptionLimitMessage
              description={watchedDescription}
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
              name="thumbnailS3Key"
              render={({ field }) => (
                <FormItem className="mt-5">
                  <Label htmlFor="fileUrl">{t("adminCourseView.settings.field.thumbnail")}</Label>
                  <FormControl>
                    <CourseThumbnailUploadField
                      inputId="fileUrl"
                      imageUrl={displayThumbnailUrl || field.value}
                      isUploading={isUploading}
                      inputRef={fileInputRef}
                      onFileSelect={handleImageUpload}
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
                  data-testid={CREATE_COURSE_PAGE_HANDLES.CANCEL_BUTTON}
                  type="button"
                  className="rounded border-2 bg-white px-6 py-2 text-primary-800"
                  onClick={() => navigate("/admin/beta-courses/new")}
                >
                  {t("common.button.cancel")}
                </Button>
                <Button
                  data-testid={CREATE_COURSE_PAGE_HANDLES.SUBMIT_BUTTON}
                  type="submit"
                  disabled={!isFormValid || isUploading}
                >
                  {t("common.button.proceed")}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddCourse;
