import { Link } from "@remix-run/react";
import { COURSE_PROGRESS_STATUSES, type SupportedLanguages } from "@repo/shared";
import { Award, BookOpen, Camera, ListOrdered, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useLearningPath } from "~/api/queries/useLearningPaths";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Icon } from "~/components/Icon";
import { getLocalizedResourceLanguage } from "~/components/LanguageSelector/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { LearningPathLanguageSelector } from "~/modules/Admin/LearningPaths/LearningPathLanguageSelector";

import { LearningPathCardActions } from "./LearningPathCardActions";
import { LearningPathCertificate } from "./LearningPathCertificate";
import { LearningPathEditableText } from "./LearningPathEditableText";
import { LearningPathHeroOutline } from "./LearningPathHeroOutline";
import { LearningPathProgressBar } from "./LearningPathProgressBar";
import { LearningPathStatusBadge } from "./LearningPathStatusBadge";
import { LearningPathTrail } from "./LearningPathTrail";

import type { GetLearningPathsResponse, UpdateLearningPathBody } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type InlineLearningPathCardProps = {
  learningPath: LearningPathListItem;
  canEdit: boolean;
  canUpdateCourses: boolean;
  canDelete: boolean;
  canManageEnrollment: boolean;
  canExport?: boolean;
  currentLanguage: SupportedLanguages;
  selectedLanguage: SupportedLanguages;
  onLanguageChange: (language: SupportedLanguages) => void;
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
  showCourseProgress?: boolean;
};

export function InlineLearningPathCard({
  learningPath,
  canEdit,
  canUpdateCourses,
  canDelete,
  canManageEnrollment,
  canExport = false,
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
  showCourseProgress = true,
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
  const displayLearningPath = localizedLearningPath ?? learningPath;
  const isCertificateReady =
    displayLearningPath.includesCertificate &&
    learningPath.courses.length > 0 &&
    learningPath.courses.every((course) => course.progress === COURSE_PROGRESS_STATUSES.COMPLETED);
  const optimisticDisplayLearningPath =
    optimisticText.language === selectedLanguage
      ? {
          ...displayLearningPath,
          title: optimisticText.title,
          description: optimisticText.description,
        }
      : displayLearningPath;

  const { formKey, selectorProps } = getLocalizedResourceLanguage({
    value: selectedLanguage,
    onChange: onLanguageChange,
    baseLanguage: learningPath.baseLanguage,
    availableLocales: learningPath.availableLocales,
    formKeyParts: [
      learningPath.id,
      optimisticDisplayLearningPath.title,
      optimisticDisplayLearningPath.description,
    ],
  });

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

  const hasManagementActions = canEdit || canExport || canDelete || canManageEnrollment;
  const totalCourseCount = learningPath.courses.length;
  const completedCourseCount = learningPath.courses.filter(
    (course) => course.progress === COURSE_PROGRESS_STATUSES.COMPLETED,
  ).length;
  const shouldShowPathProgress =
    showCourseProgress && learningPath.isEnrolled && totalCourseCount > 0;
  const nextCourse =
    learningPath.courses.find(
      (course) =>
        !course.isLocked &&
        course.progress !== COURSE_PROGRESS_STATUSES.COMPLETED &&
        course.progress !== COURSE_PROGRESS_STATUSES.BLOCKED,
    ) ?? learningPath.courses[0];
  const nextCourseActionLabel = match({
    isPathCompleted: totalCourseCount > 0 && completedCourseCount === totalCourseCount,
    isPathStarted: learningPath.courses.some(
      (course) => course.progress === COURSE_PROGRESS_STATUSES.IN_PROGRESS,
    ),
  })
    .with({ isPathCompleted: true }, () => "learningPathsView.hero.review")
    .with({ isPathStarted: true }, () => "learningPathsView.hero.continue")
    .otherwise(() => "learningPathsView.hero.start");

  const cardActions = (
    <LearningPathCardActions
      canEdit={canEdit}
      canExport={canExport}
      canDelete={canDelete}
      canManageEnrollment={canManageEnrollment}
      learningPathId={learningPath.id}
      canPlayCourses={learningPath.isEnrolled}
      isPending={isPending}
      isEnrolled={learningPath.isEnrolled}
      groupOptions={groupOptions}
      title={optimisticDisplayLearningPath.title}
      status={displayLearningPath.status}
      sequenceEnabled={displayLearningPath.sequenceEnabled}
      includesCertificate={displayLearningPath.includesCertificate}
      certificateSignatureUrl={learningPath.settings.certificateSignatureUrl}
      certificateFontColor={learningPath.settings.certificateFontColor}
      onEnrollCurrentUser={onEnrollCurrentUser}
      onDelete={onDelete}
      onEnrollStudents={onEnrollStudents}
      onEnrollGroups={onEnrollGroups}
      onUnenrollStudents={onUnenrollStudents}
      onUnenrollGroups={onUnenrollGroups}
      onStatusChange={(status) => onUpdate({ status })}
      onSequenceEnabledChange={(sequenceEnabled) => onUpdate({ sequenceEnabled })}
      onCertificateChange={(includesCertificate) => onUpdate({ includesCertificate })}
      onCertificateSignatureUpload={(certificateSignature) => onUpdate({ certificateSignature })}
      onRemoveCertificateSignature={() =>
        onUpdate({ settings: { removeCertificateSignature: true } })
      }
      onCertificateFontColorChange={(certificateFontColor) =>
        onUpdate({ settings: { certificateFontColor } })
      }
    />
  );

  return (
    <article className="relative rounded-2xl bg-white focus-within:z-30">
      <header className="relative isolate rounded-2xl bg-white">
        <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-primary-100">
          <img
            src={displayThumbnailUrl || DefaultPhotoCourse}
            alt={optimisticDisplayLearningPath.title || t("learningPathsView.detailsTitle")}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = DefaultPhotoCourse;
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--color-white),rgba(255,255,255,0.55)_15%,rgba(255,255,255,0.2)_35%,transparent_60%)]" />
          {canEdit && (
            <label className="absolute bottom-4 right-4 z-10 inline-flex h-8 cursor-pointer items-center gap-2 rounded-full !bg-white px-3 text-xs font-semibold leading-none text-neutral-900 shadow-md transition hover:!bg-white">
              <Camera className="size-4 shrink-0" />
              {isUploading ? t("uploadFile.uploading") : t("uploadFile.replace")}
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

        {hasManagementActions && (
          <div className="absolute right-4 top-4 z-20 flex flex-wrap items-start justify-end gap-2">
            {canEdit && (
              <LearningPathLanguageSelector
                formKey={formKey}
                learningPathId={learningPath.id}
                language={selectorProps.value}
                availableLocales={selectorProps.availableLocales}
                baseLanguage={selectorProps.baseLanguage ?? undefined}
                onChange={selectorProps.onChange}
                onLanguageCreated={onLanguageCreated}
                canCreateLanguage={canEdit}
              />
            )}
            {cardActions}
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-4 px-5 pb-4 pt-2 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
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

          <LearningPathEditableText
            value={optimisticDisplayLearningPath.title}
            fallback={t("adminLearningPathsView.table.untitled")}
            canEdit={canEdit}
            className={cn(
              "h1 w-full font-gothic text-2xl font-semibold leading-tight text-neutral-950 md:text-4xl",
              { "-mx-3": canEdit },
            )}
            wrap
            displayTextClassName="line-clamp-2"
            onSave={(title) => handleTextUpdate({ title })}
          />

          <LearningPathEditableText
            value={optimisticDisplayLearningPath.description}
            fallback={t("adminLearningPathsView.table.emptyDescription")}
            canEdit={canEdit}
            multiline
            displayTextClassName="line-clamp-4"
            className={cn("w-full text-sm font-normal leading-6 text-neutral-800 md:text-base", {
              "-mx-3": canEdit,
            })}
            onSave={(description) => handleTextUpdate({ description })}
          />

          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-neutral-800">
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-4" />
              {t("learningPathsView.hero.coursesCount", { count: totalCourseCount })}
            </span>
          </div>

          {shouldShowPathProgress && <LearningPathProgressBar courses={learningPath.courses} />}

          {((learningPath.isEnrolled && nextCourse) || !hasManagementActions) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 md:gap-3">
              {learningPath.isEnrolled && nextCourse && (
                <Button asChild>
                  <Link to={`/course/${nextCourse.courseId}`} className="flex items-center gap-2">
                    <Play className="size-4" fill="currentColor" />
                    <span className="text-sm font-semibold">{t(nextCourseActionLabel)}</span>
                  </Link>
                </Button>
              )}
              {!hasManagementActions && cardActions}
            </div>
          )}
        </div>
      </header>

      <section className="relative z-10 flex flex-col gap-4 px-5 pb-6 pt-4 md:px-6 md:pb-6">
        <h3 className="text-lg font-bold text-neutral-950">
          {t("learningPathsView.detail.courses")}
        </h3>

        <LearningPathTrail
          courses={learningPath.courses}
          availableCourseOptions={learningPath.availableCourseOptions}
          canManage={canUpdateCourses}
          canOpenCourses={learningPath.isEnrolled || canEdit || canUpdateCourses}
          showProgress={showCourseProgress && learningPath.isEnrolled}
          isPending={isPending}
          onAddCourses={onAddCourses}
          onReorderCourses={onReorderCourses}
          onRemoveCourse={onRemoveCourse}
        />

        {showCertificate && isCertificateReady && (
          <LearningPathCertificate
            learningPathId={learningPath.id}
            title={optimisticDisplayLearningPath.title || t("learningPathsView.detailsTitle")}
            certificateReady={isCertificateReady}
            certificateSignatureUrl={learningPath.settings.certificateSignatureUrl}
            certificateFontColor={learningPath.settings.certificateFontColor}
          />
        )}
      </section>

      <LearningPathHeroOutline />
    </article>
  );
}
