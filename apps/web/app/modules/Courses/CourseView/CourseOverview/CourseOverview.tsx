import { useNavigate } from "@remix-run/react";
import { ENTITY_TYPES } from "@repo/shared";
import { Settings, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUpdateCourseMedia } from "~/api/mutations/admin/useUpdateCourseMedia";
import { useCategories } from "~/api/queries";
import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { Button } from "~/components/ui/button";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { navigateToNextLesson } from "~/modules/Courses/utils/navigateToNextLesson";

import CourseCategoryEditor from "./CourseCategoryEditor";
import CourseDescriptionModal from "./CourseDescriptionModal";
import CourseHeroImage from "./CourseHeroImage";
import CourseMediaModal from "./CourseMediaModal";
import CourseOverviewActions from "./CourseOverviewActions";
import CourseSettingsDrawer from "./CourseSettingsDrawer";
import CourseTitleEditor from "./CourseTitleEditor";
import CourseWhatYouWillLearn from "./CourseWhatYouWillLearn";

import type { SupportedLanguages } from "@repo/shared";

type CourseHeroProps = {
  language: SupportedLanguages;
};

export default function CourseOverview({ language }: CourseHeroProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { course, isAdminExperience, isCourseStudentModeActive, isPreviewMode } =
    useCourseAccessProvider();

  const { data: categories = [] } = useCategories({
    language,
    archived: false,
  });
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);
  const { mutateAsync: updateCourse, isPending: isUpdatingCourse } = useUpdateCourse();
  const { mutateAsync: updateCourseMedia, isPending: isUpdatingMedia } = useUpdateCourseMedia();
  const { mutateAsync: initVideoUpload, isPending: isInitializingTrailer } = useInitVideoUpload();
  const { getSessionForFile, uploadVideo, isUploading: isUploadingTrailer } = useTusVideoUpload();

  const savedImagePosition = course.thumbnailPositionY ?? 50;
  const imageUrl = course.thumbnailUrl ?? CardPlaceholder;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const [heroImagePositionDraft, setHeroImagePositionDraft] = useState(savedImagePosition);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedTrailerFile, setSelectedTrailerFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(imageUrl);
  const [courseTitle, setCourseTitle] = useState(course.title);
  const [courseDescription, setCourseDescription] = useState(course.description);
  const [selectedCategoryId, setSelectedCategoryId] = useState(course.categoryId ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  const selectedCategoryTitle =
    categories.find((category) => category.id === selectedCategoryId)?.title ?? course.category;

  useEffect(() => {
    setHeroImagePositionDraft(savedImagePosition);
  }, [savedImagePosition]);

  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreviewUrl(imageUrl);
    }
  }, [imageUrl, selectedImageFile]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    setCourseTitle(course.title);
  }, [course.title]);

  useEffect(() => {
    setCourseDescription(course.description);
  }, [course.description]);

  useEffect(() => {
    setSelectedCategoryId(course.categoryId ?? "");
  }, [course.categoryId]);

  const resetMediaDraft = () => {
    setSelectedImageFile(null);
    setSelectedTrailerFile(null);
    setImagePreviewUrl(imageUrl);
    setHeroImagePositionDraft(savedImagePosition);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (trailerInputRef.current) {
      trailerInputRef.current.value = "";
    }
  };

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleTrailerSelection = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedTrailerFile(event.target.files?.[0] ?? null);
  };

  const openMediaModal = () => {
    resetMediaDraft();
    setIsMediaModalOpen(true);
  };

  const closeMediaModal = () => {
    resetMediaDraft();
    setIsMediaModalOpen(false);
  };

  const saveMediaSettings = async () => {
    if (selectedTrailerFile) {
      const session = await getSessionForFile({
        file: selectedTrailerFile,
        init: () =>
          initVideoUpload({
            filename: selectedTrailerFile.name,
            sizeBytes: selectedTrailerFile.size,
            mimeType: selectedTrailerFile.type,
            title: selectedTrailerFile.name,
            resource: ENTITY_TYPES.COURSE,
            entityId: course.id,
            entityType: ENTITY_TYPES.COURSE,
            relationshipType: "trailer",
          }),
      });

      await uploadVideo({ file: selectedTrailerFile, session });
    }

    await updateCourseMedia({
      courseId: course.id,
      data: {
        language,
        thumbnailPositionY: heroImagePositionDraft,
        ...(selectedImageFile ? { image: selectedImageFile } : {}),
      },
    });

    setSelectedImageFile(null);
    setSelectedTrailerFile(null);
    setIsMediaModalOpen(false);
  };

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

  const handleCancelTitleEdit = () => {
    setCourseTitle(course.title);
    setIsEditingTitle(false);
  };

  const handleCancelDescriptionEdit = () => {
    setCourseDescription(course.description);
  };

  const handleDescriptionChange = async () => {
    const normalizedDescription = courseDescription.trim();

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

  const handleCategoryChange = async (categoryId: string) => {
    if (categoryId === course.categoryId) {
      setIsEditingCategory(false);
      return;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        categoryId,
        language,
      },
    });

    setSelectedCategoryId(categoryId);
    setIsEditingCategory(false);
  };

  const handleSaveCourseTitle = async () => {
    const normalizedTitle = courseTitle.trim();

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
    <section className="mb-4 overflow-hidden rounded-2xl bg-white shadow-lg md:mb-6">
      <CourseHeroImage
        alt={course.title}
        imageUrl={imageUrl}
        imagePosition={course.thumbnailPositionY}
      >
        {isAdminExperience && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowSettingsDrawer(true)}
              className="absolute left-2 top-2 flex items-center gap-2  shadow-lg backdrop-blur-sm transition md:left-4 md:top-4 "
            >
              <Settings className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                {t("modernCourseView.overview.courseSettings")}
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={openMediaModal}
              className="absolute right-2 top-2 flex items-center gap-2  shadow-lg backdrop-blur-sm transition  md:right-4 md:top-4 "
            >
              <Upload className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                {t("modernCourseView.overview.editMedia")}
              </span>
            </Button>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 p-6 lg:p-8">
          <div className="lg:max-w-[62%]">
            <CourseCategoryEditor
              categoryId={selectedCategoryId}
              categoryTitle={selectedCategoryTitle}
              categories={categories}
              canEdit={isAdminExperience}
              disabled={isUpdatingCourse}
              durationSeconds={course.estimatedDurationSeconds}
              isEditing={isEditingCategory}
              onChange={handleCategoryChange}
              onClose={() => setIsEditingCategory(false)}
              onEdit={() => setIsEditingCategory(true)}
            />

            <CourseTitleEditor
              title={courseTitle}
              canEdit={isAdminExperience}
              disabled={isUpdatingCourse}
              isEditing={isEditingTitle}
              onCancel={handleCancelTitleEdit}
              onChange={setCourseTitle}
              onEdit={() => setIsEditingTitle(true)}
              onSave={handleSaveCourseTitle}
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
          heroImagePositionDraft={heroImagePositionDraft}
          imageInputRef={imageInputRef}
          trailerInputRef={trailerInputRef}
          isSaving={isSavingMedia}
          onClose={closeMediaModal}
          onSave={saveMediaSettings}
          onPositionChange={setHeroImagePositionDraft}
          onImageSelection={handleImageSelection}
          onTrailerSelection={handleTrailerSelection}
          selectedTrailerFile={selectedTrailerFile}
        />
      )}

      {showDescriptionModal && (
        <CourseDescriptionModal
          courseDescription={courseDescription}
          onChangeDescription={setCourseDescription}
          onSaveDescription={handleDescriptionChange}
          onClose={() => setShowDescriptionModal(false)}
        />
      )}

      {showSettingsDrawer && (
        <CourseSettingsDrawer
          onClose={() => setShowSettingsDrawer(false)}
          title={t("modernCourseView.overview.courseSettings")}
          courseId={course.id}
        />
      )}
    </section>
  );
}
