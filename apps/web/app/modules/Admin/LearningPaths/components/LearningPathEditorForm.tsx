import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { useLearningPathEditorActions } from "~/modules/Admin/LearningPaths/hooks/useLearningPathEditorActions";
import { useLearningPathEditorForm } from "~/modules/Admin/LearningPaths/hooks/useLearningPathEditorForm";
import { useLearningPathEditorPermissions } from "~/modules/Admin/LearningPaths/hooks/useLearningPathEditorPermissions";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../../e2e/data/learning-paths/handles";

import { LearningPathEditorCoursesSection } from "./LearningPathEditorCoursesSection";
import { LearningPathEditorDetailsSection } from "./LearningPathEditorDetailsSection";

import type { LearningPathEditorLearningPath } from "../types";
import type { SupportedLanguages } from "@repo/shared";
import type { PermissionKey } from "~/common/permissions/permission.utils";
import type { LocalizedResourceLanguageSelectorProps } from "~/components/LanguageSelector/types";

type LearningPathEditorFormProps = {
  currentUserId?: string;
  editorLanguage: SupportedLanguages;
  formKey: string;
  id?: string;
  isCreateMode: boolean;
  languageSelectorProps: LocalizedResourceLanguageSelectorProps;
  learningPath: LearningPathEditorLearningPath | null;
  permissions: PermissionKey[];
};

export function LearningPathEditorForm({
  currentUserId,
  editorLanguage,
  formKey,
  id,
  isCreateMode,
  languageSelectorProps,
  learningPath,
  permissions,
}: LearningPathEditorFormProps) {
  const { t } = useTranslation();

  const {
    form,
    displayThumbnailUrl,
    displayCertificateSignatureUrl,
    fileInputRef,
    certificateSignatureInputRef,
    handleImageUpload,
    handleCertificateSignatureUpload,
    removeThumbnail,
    removeCertificateSignature,
  } = useLearningPathEditorForm({
    learningPath,
    isCreateMode,
    editorLanguage,
  });

  const { canEdit, canUpdateCourses } = useLearningPathEditorPermissions({
    learningPath,
    currentUserId,
    permissions,
    isCreateMode,
  });

  const {
    handleSubmit,
    handleAddCourse,
    handleRemoveCourse,
    handleReorderCourses,
    isSaving,
    isCourseMutationPending,
  } = useLearningPathEditorActions({
    learningPathId: id,
    isCreateMode,
    editorLanguage,
  });

  const availableCourses = learningPath?.availableCourseOptions ?? [];
  const pathCourses = learningPath?.courses ?? [];

  return (
    <section
      className="flex flex-col gap-6 md:gap-8"
      data-testid={LEARNING_PATHS_PAGE_HANDLES.ADMIN_EDITOR_PAGE}
    >
      <div className="rounded-[2rem] border border-neutral-200 bg-white">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-800">
              {isCreateMode
                ? t("adminLearningPathsView.editor.createTitle")
                : t("adminLearningPathsView.editor.editTitle")}
            </p>
            <h1 className="h3 text-neutral-950" data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}>
              {isCreateMode
                ? t("adminLearningPathsView.editor.createTitle")
                : t("adminLearningPathsView.editor.editTitle")}
            </h1>
            <p className="body-base max-w-2xl text-neutral-700">
              {t("adminLearningPathsView.editor.description")}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            className="gap-2 shadow-sm"
            disabled={!canEdit || !form.formState.isValid || isSaving}
            onClick={form.handleSubmit(handleSubmit)}
          >
            <Save className="size-4" />
            {isCreateMode
              ? t("adminLearningPathsView.buttons.create")
              : t("adminLearningPathsView.buttons.save")}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          key={formKey}
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-6 md:gap-8"
        >
          <LearningPathEditorDetailsSection
            form={form}
            isCreateMode={isCreateMode}
            coursesCount={learningPath?.courses.length ?? 0}
            learningPathId={isCreateMode ? undefined : id}
            languageSelectorProps={languageSelectorProps}
            thumbnailUrl={displayThumbnailUrl}
            fileInputRef={fileInputRef}
            onImageUpload={handleImageUpload}
            onRemoveThumbnail={removeThumbnail}
            certificateSignatureUrl={displayCertificateSignatureUrl}
            certificateSignatureFileInputRef={certificateSignatureInputRef}
            onCertificateSignatureUpload={handleCertificateSignatureUpload}
            onRemoveCertificateSignature={removeCertificateSignature}
            canEdit={canEdit}
          />

          <LearningPathEditorCoursesSection
            isCreateMode={isCreateMode}
            canUpdateCourses={canUpdateCourses}
            isCourseMutationPending={isCourseMutationPending}
            pathCourses={pathCourses}
            availableCourseOptions={availableCourses}
            onAddCourse={handleAddCourse}
            onRemoveCourse={handleRemoveCourse}
            onReorderCourses={handleReorderCourses}
          />
        </form>
      </Form>
    </section>
  );
}
