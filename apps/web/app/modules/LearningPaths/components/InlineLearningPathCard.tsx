import { Award, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLearningPath } from "~/api/queries/useLearningPaths";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { LearningPathLanguageSelector } from "~/modules/Admin/LearningPaths/LearningPathLanguageSelector";

import { LearningPathCardActions } from "./LearningPathCardActions";
import { LearningPathCertificate } from "./LearningPathCertificate";
import { LearningPathCoursesSection } from "./LearningPathCoursesSection";
import { LearningPathEditableText } from "./LearningPathEditableText";
import { LearningPathStatusBadge } from "./LearningPathStatusBadge";

import type { GetLearningPathsResponse, UpdateLearningPathBody } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type InlineLearningPathCardProps = {
  learningPath: LearningPathListItem;
  canEdit: boolean;
  canUpdateCourses: boolean;
  canDelete: boolean;
  canManageEnrollment: boolean;
  currentLanguage: "en" | "pl" | "de" | "lt" | "cs";
  selectedLanguage: "en" | "pl" | "de" | "lt" | "cs";
  onLanguageChange: (language: "en" | "pl" | "de" | "lt" | "cs") => void;
  onUpdate: (data: UpdateLearningPathBody) => Promise<void>;
  onLanguageCreated?: () => Promise<void> | void;
  onDelete: () => void;
  onAddCourses: (courseIds: string[]) => Promise<void>;
  onRemoveCourse: (courseId: string) => Promise<void>;
  onReorderCourses: (courseIds: string[]) => Promise<void>;
  onEnrollCurrentUser?: () => Promise<void>;
  onEnrollStudents?: (studentIds: string[]) => Promise<void>;
  onEnrollGroups?: (groupIds: string[]) => Promise<void>;
  onUnenrollStudents?: (studentIds: string[]) => Promise<void>;
  onUnenrollGroups?: (groupIds: string[]) => Promise<void>;
  groupOptions: Option[];
  isPending?: boolean;
  showCertificate?: boolean;
};

const getDisplayLearningPath = (
  learningPath: LearningPathListItem,
  localizedLearningPath:
    | Partial<
        Pick<
          LearningPathListItem,
          | "title"
          | "description"
          | "thumbnailReference"
          | "status"
          | "includesCertificate"
          | "sequenceEnabled"
        >
      >
    | undefined,
) => ({
  ...learningPath,
  title: localizedLearningPath?.title ?? learningPath.title,
  description: localizedLearningPath?.description ?? learningPath.description,
  thumbnailReference: localizedLearningPath?.thumbnailReference ?? learningPath.thumbnailReference,
  status: localizedLearningPath?.status ?? learningPath.status,
  includesCertificate:
    localizedLearningPath?.includesCertificate ?? learningPath.includesCertificate,
  sequenceEnabled: localizedLearningPath?.sequenceEnabled ?? learningPath.sequenceEnabled,
});

export function InlineLearningPathCard({
  learningPath,
  canEdit,
  canUpdateCourses,
  canDelete,
  canManageEnrollment,
  currentLanguage,
  selectedLanguage,
  onLanguageChange,
  onUpdate,
  onLanguageCreated,
  onDelete,
  onAddCourses,
  onRemoveCourse,
  onReorderCourses,
  onEnrollCurrentUser,
  onEnrollStudents,
  onEnrollGroups,
  onUnenrollStudents,
  onUnenrollGroups,
  groupOptions,
  isPending = false,
  showCertificate = false,
}: InlineLearningPathCardProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayThumbnailUrl, setDisplayThumbnailUrl] = useState<string | null>(
    learningPath.thumbnailReference,
  );
  const pendingThumbnailUrlRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [optimisticText, setOptimisticText] = useState({
    language: selectedLanguage,
    title: learningPath.title,
    description: learningPath.description,
  });

  const { data: localizedLearningPathResponse } = useLearningPath(
    learningPath.id,
    { language: selectedLanguage },
    { enabled: canEdit && selectedLanguage !== currentLanguage },
  );
  const localizedLearningPath = localizedLearningPathResponse?.data;
  const displayLearningPath = getDisplayLearningPath(learningPath, localizedLearningPath);
  const isCertificateReady =
    displayLearningPath.includesCertificate &&
    learningPath.courses.length > 0 &&
    learningPath.courses.every((course) => course.progress === "completed");
  const optimisticDisplayLearningPath =
    optimisticText.language === selectedLanguage
      ? {
          ...displayLearningPath,
          title: optimisticText.title,
          description: optimisticText.description,
        }
      : displayLearningPath;

  useEffect(() => {
    setOptimisticText({
      language: selectedLanguage,
      title: optimisticDisplayLearningPath.title,
      description: optimisticDisplayLearningPath.description,
    });
  }, [
    optimisticDisplayLearningPath.description,
    optimisticDisplayLearningPath.title,
    selectedLanguage,
  ]);

  useEffect(() => {
    if (pendingThumbnailUrlRef.current) {
      URL.revokeObjectURL(pendingThumbnailUrlRef.current);
      pendingThumbnailUrlRef.current = null;
    }
    setDisplayThumbnailUrl(optimisticDisplayLearningPath.thumbnailReference);
  }, [optimisticDisplayLearningPath.thumbnailReference]);

  const handleImageChange = async (file: File) => {
    setIsUploading(true);
    const nextPreviewUrl = URL.createObjectURL(file);
    const previousThumbnailUrl = displayThumbnailUrl;
    pendingThumbnailUrlRef.current = nextPreviewUrl;
    setDisplayThumbnailUrl(nextPreviewUrl);

    try {
      await onUpdate({ thumbnail: file });
    } catch (error) {
      URL.revokeObjectURL(nextPreviewUrl);
      if (pendingThumbnailUrlRef.current === nextPreviewUrl) {
        pendingThumbnailUrlRef.current = null;
      }
      setDisplayThumbnailUrl(previousThumbnailUrl);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextUpdate = async (data: Pick<UpdateLearningPathBody, "title" | "description">) => {
    const previousText = optimisticText;
    const nextText = {
      language: selectedLanguage,
      title: data.title ?? optimisticDisplayLearningPath.title,
      description: data.description ?? optimisticDisplayLearningPath.description,
    };

    setOptimisticText(nextText);

    try {
      await onUpdate({ ...data, language: selectedLanguage });
    } catch (error) {
      setOptimisticText(previousText);
      throw error;
    }
  };

  return (
    <article className="flex flex-col rounded-xl border border-primary-100 bg-white shadow-sm md:flex-row">
      <div className="p-5 md:pr-0">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-100 md:w-[260px] md:max-w-[260px] md:rounded-tl-xl">
          <img
            src={displayThumbnailUrl || DefaultPhotoCourse}
            alt={optimisticDisplayLearningPath.title || t("learningPathsView.detailsTitle")}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = DefaultPhotoCourse;
            }}
          />
          {canEdit && (
            <label className="absolute inset-0 grid cursor-pointer place-items-center bg-neutral-950/0 text-white opacity-0 transition hover:bg-neutral-950/45 hover:opacity-100">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900">
                {isUploading ? t("uploadFile.uploading") : t("uploadFile.replace")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png, .jpg, .jpeg"
                className="sr-only"
                disabled={isUploading || isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImageChange(file);
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LearningPathEditableText
                value={optimisticDisplayLearningPath.title}
                fallback={t("adminLearningPathsView.table.untitled")}
                canEdit={canEdit}
                className="w-full text-lg font-bold leading-6 text-primary-950"
                inputClassName="text-lg font-bold leading-6"
                onSave={(title) => handleTextUpdate({ title })}
              />
            </div>
            <LearningPathEditableText
              value={optimisticDisplayLearningPath.description}
              fallback={t("adminLearningPathsView.table.emptyDescription")}
              canEdit={canEdit}
              className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-600"
              inputClassName="!mt-1 text-sm leading-6"
              onSave={(description) => handleTextUpdate({ description })}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LearningPathStatusBadge status={displayLearningPath.status} />
              {displayLearningPath.sequenceEnabled && (
                <Badge variant="default" className="gap-1.5 bg-primary-50 text-primary-700">
                  <ListOrdered className="size-3.5" />
                  {t("learningPathsView.badges.sequenceEnabled")}
                </Badge>
              )}
              {displayLearningPath.includesCertificate && (
                <Badge variant="success" className="gap-1.5">
                  <Award className="size-3.5" />
                  {t("learningPathsView.badges.certificate")}
                </Badge>
              )}
              <Badge variant="default" className="flex gap-2 bg-neutral-50 text-neutral-700">
                {courseLanguages
                  .filter((item) => learningPath.availableLocales.includes(item.key))
                  .map((item) => (
                    <Icon key={item.key} name={item.iconName} className="size-4" />
                  ))}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {canEdit && (
              <LearningPathLanguageSelector
                learningPathId={learningPath.id}
                language={selectedLanguage}
                availableLocales={learningPath.availableLocales}
                baseLanguage={learningPath.baseLanguage}
                onChange={onLanguageChange}
                onLanguageCreated={onLanguageCreated}
                canCreateLanguage={canEdit}
              />
            )}
            <LearningPathCardActions
              canEdit={canEdit}
              canDelete={canDelete}
              canManageEnrollment={canManageEnrollment}
              learningPathId={learningPath.id}
              canPlayCourses={learningPath.isEnrolled}
              isPending={isPending}
              isEnrolled={learningPath.isEnrolled}
              groupOptions={groupOptions}
              status={displayLearningPath.status}
              sequenceEnabled={displayLearningPath.sequenceEnabled}
              includesCertificate={displayLearningPath.includesCertificate}
              onEnrollCurrentUser={onEnrollCurrentUser}
              onDelete={onDelete}
              onEnrollStudents={onEnrollStudents}
              onEnrollGroups={onEnrollGroups}
              onUnenrollStudents={onUnenrollStudents}
              onUnenrollGroups={onUnenrollGroups}
              onStatusChange={(status) => onUpdate({ status })}
              onSequenceEnabledChange={(sequenceEnabled) => onUpdate({ sequenceEnabled })}
              onCertificateChange={(includesCertificate) => onUpdate({ includesCertificate })}
            />
          </div>
        </div>

        <LearningPathCoursesSection
          availableCourseOptions={learningPath.availableCourseOptions}
          pathCourses={learningPath.courses}
          isPending={isPending}
          canManage={canUpdateCourses}
          canPlayCourses={learningPath.isEnrolled}
          onAddCourses={onAddCourses}
          onReorderCourses={onReorderCourses}
          onRemoveCourse={onRemoveCourse}
        />

        {showCertificate && isCertificateReady && (
          <LearningPathCertificate
            learningPathId={learningPath.id}
            title={optimisticDisplayLearningPath.title || t("learningPathsView.detailsTitle")}
            certificateReady={isCertificateReady}
            className="mt-5"
          />
        )}
      </div>
    </article>
  );
}
