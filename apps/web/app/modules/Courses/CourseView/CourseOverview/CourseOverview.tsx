import { useNavigate } from "@remix-run/react";
import { Settings, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import { useCategories } from "~/api/queries";
import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { navigateToNextLesson } from "~/modules/Courses/utils/navigateToNextLesson";

import CourseCategoryEditor from "./CourseCategoryEditor";
import CourseDescriptionModal from "./CourseDescriptionModal";
import CourseHeroImage from "./CourseHeroImage";
import CourseMediaModal from "./CourseMediaModal";
import CourseOverviewActions from "./CourseOverviewActions";
import CourseSettingsDrawer from "./CourseSettingsDrawer";
import CourseTitleEditor from "./CourseTitleEditor";

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
  const { mutateAsync: uploadFile, isPending: isUploadingImage } = useUploadFile();

  const savedImagePosition = course.thumbnailPositionY ?? 50;
  const imageUrl = course.thumbnailUrl ?? CardPlaceholder;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [heroImagePositionDraft, setHeroImagePositionDraft] = useState(savedImagePosition);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
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
    setImagePreviewUrl(imageUrl);
    setHeroImagePositionDraft(savedImagePosition);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
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
    let thumbnailS3Key: string | undefined;

    if (selectedImageFile) {
      const uploadResult = await uploadFile({
        file: selectedImageFile,
        resource: "course",
      });

      thumbnailS3Key = uploadResult.fileKey;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        language,
        thumbnailPositionY: heroImagePositionDraft,
        ...(thumbnailS3Key ? { thumbnailS3Key } : {}),
      },
    });

    setSelectedImageFile(null);
    setIsMediaModalOpen(false);
  };

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
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(true)}
              className="absolute left-2 top-2 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-lg backdrop-blur-sm transition hover:bg-neutral-200 md:left-4 md:top-4 md:px-4 md:py-2"
            >
              <Settings className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                {t("modernCourseView.overview.courseSettings")}
              </span>
            </button>

            <button
              type="button"
              onClick={openMediaModal}
              className="absolute right-2 top-2 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-lg backdrop-blur-sm transition hover:bg-neutral-200 md:right-4 md:top-4 md:px-4 md:py-2"
            >
              <Upload className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                {t("modernCourseView.overview.editMedia")}
              </span>
            </button>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 p-6 lg:p-8">
          <div className="max-w-[65%]">
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
      </CourseHeroImage>

      {isMediaModalOpen && (
        <CourseMediaModal
          imagePreviewUrl={imagePreviewUrl}
          heroImagePositionDraft={heroImagePositionDraft}
          imageInputRef={imageInputRef}
          isSaving={isUpdatingCourse || isUploadingImage}
          onClose={closeMediaModal}
          onSave={saveMediaSettings}
          onPositionChange={setHeroImagePositionDraft}
          onImageSelection={handleImageSelection}
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
        />
      )}
    </section>
  );
}
