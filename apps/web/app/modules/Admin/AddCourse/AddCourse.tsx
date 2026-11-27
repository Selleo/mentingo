import { Link, useNavigate, useOutlet, useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Sparkles } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import { useCategoriesSuspense } from "~/api/queries/useCategories";
import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { Button } from "~/components/ui/button";
import { DrawerTrigger } from "~/components/ui/drawer";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { usePermissions } from "~/hooks/usePermissions";
import { CourseAuthoringDrawer } from "~/modules/CourseAuthoring/CourseAuthoringDrawer";
import { setPageTitle } from "~/utils/setPageTitle";

import { CREATE_COURSE_PAGE_HANDLES } from "../../../../e2e/data/courses/handles";

import Breadcrumb from "./components/Breadcrumb";
import { CourseDescriptionLimitMessage } from "./components/CourseDescriptionLimitMessage";
import { CourseMetadataFields } from "./components/CourseMetadataFields";
import { CourseThumbnailUploadField } from "./components/CourseThumbnailUploadField";
import { useAddCourseForm } from "./hooks/useAddCourseForm";
import {
  AI_COURSE_CREATION_PATH,
  STANDARD_COURSE_CREATION_PATH,
  withAddCourseContext,
  withCourseDraft,
} from "./utils/addCourseOrigin";

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
  const draftOutlet = useOutlet();
  const [searchParams] = useSearchParams();
  const { hasAccess } = usePermissions({
    all: [PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_AI_GENERATION],
  });
  const { data: luma } = useLumaConfigured();
  const canCreateWithAi = hasAccess && luma?.courseGenerationEnabled;
  const aiDescriptionId = useId();
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

  const formContent = (
    <div
      data-testid={CREATE_COURSE_PAGE_HANDLES.PAGE}
      className="flex h-screen overflow-auto bg-white px-4 py-8 sm:px-8 xl:px-20"
    >
      <div className="hidden w-full items-center justify-center lg:flex">
        <img src={SplashScreenImage} alt="" className="rounded" />
      </div>
      <div className="mx-auto flex w-full min-w-0 max-w-[820px] flex-col gap-y-6 lg:mx-0 lg:px-8">
        <Breadcrumb
          backTo={withAddCourseContext("/admin/beta-courses/new", searchParams)}
          currentLabel={t("adminCourseTypeSelector.standard.title")}
        />
        <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <hgroup className="flex min-w-0 flex-1 basis-60 flex-col gap-y-1">
            <h1 data-testid={CREATE_COURSE_PAGE_HANDLES.HEADING} className="h3 text-neutral-950">
              {t("adminCourseView.settings.header")}
            </h1>
            <p className="body-lg-md text-neutral-800">{t("adminCourseView.settings.subHeader")}</p>
          </hgroup>
          {canCreateWithAi && (
            <>
              <DrawerTrigger asChild>
                <Button asChild variant="outline" className="gap-2">
                  <Link
                    to={withCourseDraft(AI_COURSE_CREATION_PATH, searchParams)}
                    data-testid={CREATE_COURSE_PAGE_HANDLES.CREATE_WITH_AI_BUTTON}
                    aria-describedby={aiDescriptionId}
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    {t("adminCourseTypeSelector.ai.title")}
                  </Link>
                </Button>
              </DrawerTrigger>
              <span id={aiDescriptionId} className="sr-only">
                {t("adminCourseTypeSelector.ai.description")}
              </span>
            </>
          )}
        </header>
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
                  onClick={() =>
                    navigate(withAddCourseContext("/admin/beta-courses/new", searchParams))
                  }
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

  return (
    <CourseAuthoringDrawer
      open={Boolean(draftOutlet)}
      onOpenChange={(open) => {
        if (!open) {
          navigate(withCourseDraft(STANDARD_COURSE_CREATION_PATH, searchParams), { replace: true });
        }
      }}
      background={formContent}
      title={t("adminCourseTypeSelector.ai.title")}
      description={t("adminCourseTypeSelector.ai.description")}
    >
      {draftOutlet}
    </CourseAuthoringDrawer>
  );
};

export default AddCourse;
