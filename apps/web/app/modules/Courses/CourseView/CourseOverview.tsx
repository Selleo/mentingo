import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Clock, GraduationCap, Info, Play, Settings, Upload, X } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import { useCategories, useCurrentUser } from "~/api/queries";
import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";
import { navigateToNextLesson } from "~/modules/Courses/utils/navigateToNextLesson";

import type { SupportedLanguages } from "@repo/shared";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseHeroProps = {
  course: GetCourseResponse["data"];
  language: SupportedLanguages;
};

export default function CourseOverview({ course, language }: CourseHeroProps) {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { hasAccess: canManageUsers } = usePermissions({
    required: PERMISSIONS.USER_MANAGE,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { isCourseStudentModeActive, isPreviewMode } = useCourseAccessProvider();
  const { data: categories = [] } = useCategories({
    language,
    archived: false,
  });
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);
  const { mutateAsync: updateCourse, isPending: isUpdatingCourse } = useUpdateCourse();
  const { mutateAsync: uploadFile, isPending: isUploadingImage } = useUploadFile();

  const savedImagePosition = course.thumbnailPositionY ?? 50;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [heroImagePositionDraft, setHeroImagePositionDraft] = useState(savedImagePosition);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(course.thumbnailUrl ?? CardPlaceholder);

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
  useEffect(() => {
    setHeroImagePositionDraft(savedImagePosition);
  }, [savedImagePosition]);
  const [courseTitle, setCourseTitle] = useState(course.title);
  const [courseDescription, setCourseDescription] = useState(course.description);
  const [selectedCategoryId, setSelectedCategoryId] = useState(course.categoryId ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const canEditCourse = canManageUsers || (canManageCourses && course.authorId === currentUser?.id);
  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;
  const imageUrl = course.thumbnailUrl ?? CardPlaceholder;

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

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const openMediaModal = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(imageUrl);
    setHeroImagePositionDraft(savedImagePosition);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    setIsMediaModalOpen(true);
  };

  const closeMediaModal = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(imageUrl);
    setHeroImagePositionDraft(savedImagePosition);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    setIsMediaModalOpen(false);
  };

  useEffect(() => {
    setCourseTitle(course.title);
  }, [course.title]);

  useEffect(() => {
    setCourseDescription(course.description);
  }, [course.description]);

  useEffect(() => {
    setSelectedCategoryId(course.categoryId ?? "");
  }, [course.categoryId]);

  const handleToggleLearningMode = () => {
    toggleLearningMode({ enabled: !isCourseStudentModeActive });
  };

  const handleContinueLearning = () => {
    navigateToNextLesson(course, navigate, { openFirstLesson: isPreviewMode });
  };

  const handleCancelTitleEdit = () => {
    setCourseTitle(course.title);
    setIsEditingTitle(false);
  };

  const handleCancelDescriptionEdit = () => {
    setCourseDescription(course.description);
  };

  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const selectedCategoryTitle =
    categories.find((category) => category.id === selectedCategoryId)?.title ?? course.category;

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

  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  return (
    <section className="mb-4 overflow-hidden rounded-2xl bg-white shadow-lg md:mb-6">
      <div className="group relative aspect-[4/3] md:aspect-[21/9]">
        <img
          src={imageUrl}
          style={{
            objectPosition: `center ${course.thumbnailPositionY ?? 50}%`,
          }}
          alt={course.title}
          className="size-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

        {isAdminExperience && (
          <>
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(true)}
              className="absolute left-2 top-2 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur-sm transition hover:bg-white md:left-4 md:top-4 md:px-4 md:py-2"
            >
              <Settings className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                Course settings
              </span>
            </button>

            <button
              type="button"
              onClick={openMediaModal}
              className="absolute right-2 top-2 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 opacity-0 shadow-lg backdrop-blur-sm transition hover:bg-white group-hover:opacity-100 md:right-4 md:top-4 md:px-4 md:py-2"
            >
              <Upload className="size-4 text-primary-700" />

              <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">
                Edit media
              </span>
            </button>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 p-6 lg:p-8">
          <div className="max-w-[65%]">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {isAdminExperience && isEditingCategory ? (
                <Select
                  open={isEditingCategory}
                  value={selectedCategoryId}
                  disabled={isUpdatingCourse}
                  onValueChange={(categoryId) => {
                    void handleCategoryChange(categoryId);
                  }}
                  onOpenChange={(open) => {
                    if (!open) {
                      setIsEditingCategory(false);
                    }
                  }}
                >
                  <SelectTrigger
                    id="course-category"
                    className="h-8 w-auto min-w-40 rounded-full border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-950 shadow-lg transition-colors hover:bg-neutral-50 focus:ring-2 focus:ring-white/70"
                  >
                    <SelectValue placeholder={selectedCategoryTitle} />
                  </SelectTrigger>

                  <SelectContent className="border-neutral-200 bg-white text-neutral-950 shadow-xl">
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="cursor-pointer focus:bg-neutral-100 focus:text-neutral-950"
                      >
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <button
                  type="button"
                  disabled={!isAdminExperience}
                  onClick={() => {
                    if (isAdminExperience) {
                      setIsEditingCategory(true);
                    }
                  }}
                  className={cn(
                    "rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all duration-200",
                    {
                      "cursor-pointer outline-2 outline-dashed outline-transparent hover:bg-white/30 hover:outline-white focus-visible:bg-white/30 focus-visible:outline-white":
                        isAdminExperience,
                    },
                  )}
                >
                  {selectedCategoryTitle}
                </button>
              )}

              <span className="flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Clock className="size-3.5" />
                {formatDuration(course.estimatedDurationSeconds)}
              </span>

              {course.dueDate && (
                <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {course.dueDate}
                </span>
              )}
            </div>

            {!isEditingTitle ? (
              <h1 className="mb-4 text-xl font-bold leading-snug text-white md:text-3xl md:leading-tight lg:text-4xl">
                {isAdminExperience ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="w-full rounded-lg border-2 border-dashed border-transparent p-2 text-left transition-colors duration-200 hover:border-white hover:bg-white/10 focus-visible:border-white focus-visible:bg-primary-700"
                  >
                    {courseTitle}
                  </button>
                ) : (
                  courseTitle
                )}
              </h1>
            ) : (
              <textarea
                value={courseTitle}
                disabled={isUpdatingCourse}
                onChange={(event) => {
                  setCourseTitle(event.target.value);
                }}
                onBlur={() => {
                  void handleSaveCourseTitle();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    handleCancelTitleEdit();
                  }
                }}
                className="mb-4 w-full resize-none rounded-lg border-2 border-primary-700 bg-white/95 px-2 py-1 text-2xl font-bold leading-tight text-neutral-950 md:text-3xl lg:text-4xl"
                rows={2}
              />
            )}
            <div className="hidden flex-wrap items-center gap-3 md:flex">
              {isAdminExperience ? (
                <button
                  type="button"
                  disabled={isTogglingLearningMode}
                  onClick={handleToggleLearningMode}
                  className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-white shadow-2xl transition hover:bg-primary-800 disabled:opacity-50"
                >
                  <GraduationCap className="size-4" />

                  <span className="text-sm font-semibold">Enter learning mode</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleContinueLearning}
                  className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-white shadow-2xl transition hover:bg-primary-800"
                >
                  <Play className="size-4" fill="currentColor" />

                  <span className="text-sm font-semibold">Continue learning</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDescriptionModal(true)}
                className="flex items-center gap-2 rounded-lg border-2 border-white/40 px-4 py-2 text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Info className="size-4" />

                <span className="text-sm font-semibold">Course details</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
                Edit Course Media
              </h3>
              <button type="button" onClick={closeMediaModal}>
                <X className="w-5 h-5 md:w-6 md:h-6 text-[#676767]" />
              </button>
            </div>

            {/* Current Hero Image Preview with Position Adjustment */}
            <div className="mb-6">
              <p className="mb-3 block text-sm font-semibold text-[#363636]">
                Current Hero Image - Adjust Position
              </p>
              <div className="relative aspect-[21/9] rounded-xl overflow-hidden border-2 border-[#e5e5e5] mb-4">
                <img
                  src={imagePreviewUrl}
                  alt="Course hero preview"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `center ${heroImagePositionDraft}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 text-white text-sm font-semibold">
                  Preview with current position
                </div>
              </div>

              {/* Position Slider */}
              <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#e5e5e5]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#363636]">Vertical Position</p>
                  {/* <span className="text-sm text-[#676767]">{heroImagePosition}%</span> */}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={heroImagePositionDraft}
                  onChange={(event) => setHeroImagePositionDraft(Number(event.target.value))}
                  className="w-full cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-[#676767] mt-1">
                  <span>{heroImagePositionDraft}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Hero Image Upload */}
              <div>
                <p className="mb-3 block text-sm font-semibold text-[#363636]">
                  Upload New Hero Image
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageSelection}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e5e5e5] bg-gray-50 p-6 text-center transition-colors hover:border-[#3f58b6] hover:bg-gray-100 md:h-48 md:p-8"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                    <Upload className="w-8 h-8 text-[#3f58b6]" />
                  </div>
                  <p className="text-sm font-semibold text-[#363636] mb-1">Drop hero image here</p>
                  <p className="text-xs text-[#676767] mb-3">or click to browse</p>
                  <p className="text-xs text-[#676767]">PNG, JPG up to 10MB</p>
                  <p className="text-xs text-[#676767]">Recommended: 1920x820px (21:9)</p>
                </button>
              </div>

              {/* Trailer Video Upload */}
              <div>
                <p className="mb-3 block text-sm font-semibold text-[#363636]">
                  Course Trailer (Optional)
                </p>
                <div className="border-2 border-dashed border-[#e5e5e5] rounded-xl p-6 md:p-8 text-center hover:border-[#3f58b6] transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100 h-40 md:h-48 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-3">
                    <Play className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold text-[#363636] mb-1">
                    Drop trailer video here
                  </p>
                  <p className="text-xs text-[#676767] mb-3">or click to browse</p>
                  <p className="text-xs text-[#676767]">MP4, MOV up to 50MB</p>
                  <p className="text-xs text-[#676767]">Recommended: 30-90 seconds</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMediaModal}
                disabled={isUpdatingCourse || isUploadingImage}
                className="px-6 py-2 bg-gray-200 text-[#363636] rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveMediaSettings()}
                disabled={isUpdatingCourse || isUploadingImage}
                className="px-6 py-2 bg-[#3f58b6] text-white rounded-lg font-semibold hover:bg-[#324a95] transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Media
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Course Description Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <button
            type="button"
            aria-label="Close course description"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDescriptionModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
                  About This Course
                </h3>
                <button
                  onClick={() => setShowDescriptionModal(false)}
                  className="w-10 h-10 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-[#676767]" />
                </button>
              </div>

              {/* Course Title */}
              <div className="mb-6">
                <h4 className="text-xl font-bold text-[#363636] mb-2">{courseTitle}</h4>
                <div className="flex items-center gap-2 text-sm text-[#676767]">
                  <span className="px-3 py-1 bg-blue-50 text-[#3f58b6] rounded-full font-semibold">
                    {course.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(course.estimatedDurationSeconds)}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h5 className="font-bold text-[#363636] mb-3">Description</h5>
                {isAdminExperience ? (
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    className="w-full p-3 border-2 border-[#e5e5e5] rounded-lg text-[#363636] leading-relaxed focus:outline-none focus:border-[#3f58b6] min-h-[120px]"
                    placeholder="Enter course description..."
                    onBlur={() => void handleDescriptionChange()}
                  />
                ) : (
                  <p className="text-[#676767] leading-relaxed">{course.description}</p>
                )}
              </div>

              {/* What You'll Learn */}
              <div className="mb-6">
                <h5 className="font-bold text-[#363636] mb-3">What You&apos;ll Learn</h5>
                <div className="space-y-2"></div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDescriptionModal(false)}
                  className="px-6 py-2 bg-[#3f58b6] text-white rounded-lg font-semibold hover:bg-[#324a95] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSettingsDrawer && (
        <>
          {/* Overlay */}
          <button
            type="button"
            aria-label="Close course settings"
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setShowSettingsDrawer(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-50 transform transition-transform">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#e5e5e5]">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-[#3f58b6]" />
                  <h2 className="font-gothic text-2xl font-bold text-[#363636]">Course Settings</h2>
                </div>
                <button
                  onClick={() => setShowSettingsDrawer(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#676767]" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="space-y-4 md:space-y-6">
                  {/* Placeholder */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <Settings className="w-12 h-12 text-[#3f58b6] mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-[#363636] mb-2">
                      Settings Coming Soon
                    </h3>
                    <p className="text-sm text-[#676767]">Here you&apos;ll be able to configure:</p>
                    <ul className="mt-4 space-y-2 text-sm text-[#676767] text-left">
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Course status (Draft/Published)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Pricing & payment options</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Assigned students & groups</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Enforce sequential completion</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Course visibility settings</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3f58b6] font-bold">•</span>
                        <span>Access permissions</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 md:p-6 border-t border-[#e5e5e5]">
                <button
                  onClick={() => setShowSettingsDrawer(false)}
                  className="w-full px-6 py-3 bg-[#3f58b6] text-white rounded-lg font-semibold hover:bg-[#324a95] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
