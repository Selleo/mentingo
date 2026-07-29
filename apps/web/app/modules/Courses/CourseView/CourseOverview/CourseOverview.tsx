import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { ENTITY_TYPES, PERMISSIONS } from "@repo/shared";
import { Settings, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import useGenerateMissingTranslations from "~/api/mutations/admin/useGenerateMissingTranslations";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUpdateCourseMedia } from "~/api/mutations/admin/useUpdateCourseMedia";
import { useCategories, useCurrentUser } from "~/api/queries";
import { useAIConfigured } from "~/api/queries/useAIConfigured";
import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { cn } from "~/lib/utils";
import { useObjectUrl } from "~/modules/Admin/AddCourse/hooks/useObjectUrl";
import { CourseLanguageSelector } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { navigateToNextLesson } from "~/modules/Courses/utils/navigateToNextLesson";

import {
  COURSE_LANGUAGE_DIALOG_HANDLES,
  COURSE_OVERVIEW_HANDLES,
} from "../../../../../e2e/data/courses/handles";

import CourseCategoryEditor from "./CourseCategoryEditor";
import CourseDescriptionModal from "./CourseDescriptionModal";
import CourseHeroImage from "./CourseHeroImage";
import CourseMediaModal from "./CourseMediaModal";
import { courseOverviewFormSchema, type CourseOverviewFormValues } from "./CourseOverview.schema";
import CourseOverviewActions from "./CourseOverviewActions";
import CourseSettingsDrawer from "./CourseSettingsDrawer";
import CourseTitleEditor from "./CourseTitleEditor";
import CourseWhatYouWillLearn from "./CourseWhatYouWillLearn";

import type { SupportedLanguages } from "@repo/shared";

type CourseHeroProps = {
  language: SupportedLanguages;
  onLanguageChange: (language: SupportedLanguages) => void;
  openGenerateTranslationModal: boolean;
  setOpenGenerateTranslationModal: (open: boolean) => void;
};

export default function CourseOverview({
  language,
  onLanguageChange,
  openGenerateTranslationModal,
  setOpenGenerateTranslationModal,
}: CourseHeroProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { course, isAdminExperience, isCourseStudentModeActive, isPreviewMode } =
    useCourseAccessProvider();

  const { data: currentUser } = useCurrentUser();
  const { data: categories = [] } = useCategories({
    language,
  });
  const canManageCategories = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.CATEGORY_MANAGE,
  );
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);
  const { mutateAsync: updateCourse, isPending: isUpdatingCourse } = useUpdateCourse();
  const { mutateAsync: updateCourseMedia, isPending: isUpdatingMedia } = useUpdateCourseMedia();
  const { mutateAsync: initVideoUpload, isPending: isInitializingTrailer } = useInitVideoUpload();
  const { mutateAsync: generateTranslations, isPending: isGeneratingTranslations } =
    useGenerateMissingTranslations();
  const { data: isAIConfigured } = useAIConfigured();
  const { getSessionForFile, uploadVideo, isUploading: isUploadingTrailer } = useTusVideoUpload();

  const savedImagePosition = course.thumbnailPositionY ?? 50;
  const imageUrl = course.thumbnailUrl ?? CardPlaceholder;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  const { handleSubmit, reset, setValue, watch } = useForm<CourseOverviewFormValues>({
    resolver: zodResolver(courseOverviewFormSchema),
    defaultValues: {
      categoryId: course.categoryId ?? "",
      description: course.description,
      heroImagePosition: savedImagePosition,
      imageFile: null,
      title: course.title,
      trailerFile: null,
    },
  });
  const { categoryId, description, heroImagePosition, imageFile, title, trailerFile } = watch();

  const selectedImagePreviewUrl = useObjectUrl(imageFile);
  const imagePreviewUrl = selectedImagePreviewUrl ?? imageUrl;
  const selectedCategoryTitle =
    categories.find((category) => category.id === categoryId)?.title ?? course.category;

  useEffect(() => {
    reset({
      categoryId: course.categoryId ?? "",
      description: course.description,
      heroImagePosition: savedImagePosition,
      imageFile: null,
      title: course.title,
      trailerFile: null,
    });
  }, [course.categoryId, course.description, course.title, reset, savedImagePosition]);

  const resetMediaDraft = () => {
    setValue("imageFile", null);
    setValue("trailerFile", null);
    setValue("heroImagePosition", savedImagePosition);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (trailerInputRef.current) {
      trailerInputRef.current.value = "";
    }
  };

  const handleImageSelection = (file: File) => {
    setValue("imageFile", file, { shouldDirty: true, shouldValidate: true });
  };

  const handleTrailerSelection = (file: File) => {
    setValue("trailerFile", file, { shouldDirty: true, shouldValidate: true });
  };

  const openMediaModal = () => {
    resetMediaDraft();
    setIsMediaModalOpen(true);
  };

  const closeMediaModal = () => {
    resetMediaDraft();
    setIsMediaModalOpen(false);
  };

  const saveMediaSettings = handleSubmit(async (values) => {
    const selectedTrailer = values.trailerFile;

    if (selectedTrailer) {
      const session = await getSessionForFile({
        file: selectedTrailer,
        init: () =>
          initVideoUpload({
            filename: selectedTrailer.name,
            sizeBytes: selectedTrailer.size,
            mimeType: selectedTrailer.type,
            title: selectedTrailer.name,
            resource: ENTITY_TYPES.COURSE,
            entityId: course.id,
            entityType: ENTITY_TYPES.COURSE,
            relationshipType: "trailer",
          }),
      });

      await uploadVideo({ file: selectedTrailer, session });
    }

    await updateCourseMedia({
      courseId: course.id,
      data: {
        language,
        thumbnailPositionY: values.heroImagePosition,
        ...(values.imageFile ? { image: values.imageFile } : {}),
      },
    });

    resetMediaDraft();
    setIsMediaModalOpen(false);
  });

  const isSavingMedia = isUpdatingMedia || isInitializingTrailer || isUploadingTrailer;

  const handleToggleLearningMode = () => {
    toggleLearningMode({ enabled: !isCourseStudentModeActive });
  };

  const handleContinueLearning = () => {
    navigateToNextLesson(course, navigate, { openFirstLesson: isPreviewMode });
  };

  const handleOpenDescriptionModal = () => {
    setShowDescriptionModal(true);
  };

  const handleGenerateTranslations = async () => {
    await generateTranslations({ courseId: course.id, language });
    setOpenGenerateTranslationModal(false);
  };

  const handleCancelTitleEdit = () => {
    setValue("title", course.title);
    setIsEditingTitle(false);
  };

  const handleCancelDescriptionEdit = () => {
    setValue("description", course.description);
  };

  const handleDescriptionChange = async () => {
    const normalizedDescription = description.trim();

    if (!normalizedDescription) {
      handleCancelDescriptionEdit();
      return;
    }

    if (normalizedDescription === course.description) {
      return;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        description: normalizedDescription,
        language,
      },
    });
  };

  const handleCategoryChange = async (nextCategoryId: string) => {
    if (nextCategoryId === course.categoryId) {
      setIsEditingCategory(false);
      return;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        categoryId: nextCategoryId,
        language,
      },
    });

    setValue("categoryId", nextCategoryId);
    setIsEditingCategory(false);
  };

  const handleSaveCourseTitle = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      handleCancelTitleEdit();
      return;
    }

    if (normalizedTitle === course.title) {
      setIsEditingTitle(false);
      return;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        title: normalizedTitle,
        language,
      },
    });

    setIsEditingTitle(false);
  };

  return (
    <section
      data-testid={COURSE_OVERVIEW_HANDLES.HERO}
      className="mb-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-white shadow-lg md:mb-6"
    >
      <CourseHeroImage
        alt={course.title}
        imageUrl={imageUrl}
        imagePosition={course.thumbnailPositionY}
      >
        {isAdminExperience && (
          <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2 md:inset-x-4 md:top-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                data-testid={COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON}
                onClick={() => setShowSettingsDrawer(true)}
                className="flex size-10 shrink-0 items-center gap-2 p-0 shadow-lg backdrop-blur-sm transition sm:w-auto sm:px-4"
              >
                <Settings className="size-4 text-primary-700" />

                <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                  {t("modernCourseView.overview.courseSettings")}
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={openMediaModal}
                data-testid={COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON}
                className="flex size-10 shrink-0 items-center gap-2 p-0 shadow-lg backdrop-blur-sm transition sm:w-auto sm:px-4"
              >
                <Upload className="size-4 text-primary-700" />

                <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                  {t("modernCourseView.overview.editMedia")}
                </span>
              </Button>
            </div>

            <CourseLanguageSelector
              courseLanguage={language}
              course={{
                id: course.id,
                baseLanguage: course.baseLanguage,
                availableLocales: course.availableLocales,
              }}
              isAIConfigured={isAIConfigured?.enabled ?? false}
              onChange={onLanguageChange}
              setOpenGenerateTranslationModal={setOpenGenerateTranslationModal}
              className="min-w-0 shrink-0 gap-1 sm:gap-2"
              compactOnMobile
              selectTriggerClassName="w-12 min-w-12 px-1.5 min-[360px]:w-14 min-[360px]:min-w-14 min-[360px]:px-2 sm:w-auto sm:min-w-[200px] sm:px-3"
              tooltipIconClassName="hidden text-white min-[360px]:block"
            />
          </div>
        )}

        <div
          className={cn(
            "relative z-10 flex flex-col justify-end px-4 pb-6 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8",
            isAdminExperience ? "pt-28 sm:pt-24 lg:pt-8" : "pt-6",
          )}
        >
          <div
            data-testid={COURSE_OVERVIEW_HANDLES.HERO_CONTENT}
            className="min-w-0 max-w-full lg:max-w-[62%]"
          >
            <CourseCategoryEditor
              categoryId={categoryId}
              categoryTitle={selectedCategoryTitle}
              categories={categories}
              canEdit={isAdminExperience}
              canManageCategories={canManageCategories}
              disabled={isUpdatingCourse}
              durationSeconds={course.estimatedDurationSeconds}
              isEditing={isEditingCategory}
              onChange={handleCategoryChange}
              onClose={() => setIsEditingCategory(false)}
              onEdit={() => setIsEditingCategory(true)}
            />

            <CourseTitleEditor
              title={title}
              canEdit={isAdminExperience}
              disabled={isUpdatingCourse}
              isEditing={isEditingTitle}
              onCancel={handleCancelTitleEdit}
              onChange={(nextTitle) =>
                setValue("title", nextTitle, { shouldDirty: true, shouldValidate: true })
              }
              onEdit={() => setIsEditingTitle(true)}
              onSave={handleSaveCourseTitle}
              placeholder={t("modernCourseView.overview.titlePlaceholder")}
            />

            <CourseOverviewActions
              isTogglingLearningMode={isTogglingLearningMode}
              onToggleLearningMode={handleToggleLearningMode}
              onContinueLearning={handleContinueLearning}
              onOpenDetails={handleOpenDescriptionModal}
            />
          </div>
        </div>
        <CourseWhatYouWillLearn courseOutcomes={course.learningOutcomes} language={language} />
      </CourseHeroImage>

      {isMediaModalOpen && (
        <CourseMediaModal
          imagePreviewUrl={imagePreviewUrl}
          heroImagePositionDraft={heroImagePosition}
          imageInputRef={imageInputRef}
          trailerInputRef={trailerInputRef}
          isSaving={isSavingMedia}
          onClose={closeMediaModal}
          onSave={saveMediaSettings}
          onPositionChange={(position) =>
            setValue("heroImagePosition", position, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onImageSelection={handleImageSelection}
          onTrailerSelection={handleTrailerSelection}
          selectedTrailerFile={trailerFile}
        />
      )}

      <Dialog open={openGenerateTranslationModal} onOpenChange={setOpenGenerateTranslationModal}>
        <DialogContent data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_DIALOG}>
          <DialogTitle>{t("adminCourseView.common.generateMissingTranslations")}</DialogTitle>
          <DialogDescription>
            {t("adminCourseView.common.generateMissingTranslationsDescription")}
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CANCEL_BUTTON}
                variant="outline"
              >
                {t("contentCreatorView.button.cancel")}
              </Button>
            </DialogClose>
            <Button
              data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.GENERATE_CONFIRM_BUTTON}
              type="button"
              onClick={handleGenerateTranslations}
              disabled={isGeneratingTranslations}
            >
              {isGeneratingTranslations ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-t-2 border-gray-300 border-t-gray-900" />
                  {t("contentCreatorView.button.confirm")}
                </span>
              ) : (
                t("contentCreatorView.button.confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDescriptionModal && (
        <CourseDescriptionModal
          courseDescription={description}
          onChangeDescription={(nextDescription) =>
            setValue("description", nextDescription, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onSaveDescription={handleDescriptionChange}
          onClose={() => setShowDescriptionModal(false)}
        />
      )}

      <CourseSettingsDrawer
        courseId={course.id}
        onOpenChange={setShowSettingsDrawer}
        open={showSettingsDrawer}
        title={t("modernCourseView.overview.courseSettings")}
      />
    </section>
  );
}
