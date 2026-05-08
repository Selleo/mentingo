import { useLoaderData, useLocation, useParams } from "@remix-run/react";
import { Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { learningPathQueryOptions, useLearningPath } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import { LearningPathEditorCoursesSection } from "./components/LearningPathEditorCoursesSection";
import { LearningPathEditorDetailsSection } from "./components/LearningPathEditorDetailsSection";
import { useLearningPathEditorActions } from "./hooks/useLearningPathEditorActions";
import { useLearningPathEditorForm } from "./hooks/useLearningPathEditorForm";
import { useLearningPathEditorPermissions } from "./hooks/useLearningPathEditorPermissions";

import type { LearningPathEditorLearningPath } from "./types";
import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPathEditor");

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  if (!params.id || params.id === "new") return null;

  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathQueryOptions(params.id, { language }));
};

export default function LearningPathEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { pathname } = useLocation();
  const loaderLearningPath = useLoaderData<typeof clientLoader>();
  const { data: currentUser } = useCurrentUserSuspense();
  const { permissions } = usePermissions();
  const isCreateMode = pathname.endsWith("/admin/learning-paths/new");
  const { language: appLanguage } = useLanguageStore.getState();
  const [editorLanguage, setEditorLanguage] = useState<SupportedLanguages>(
    loaderLearningPath?.data.baseLanguage ?? appLanguage,
  );

  const { data: learningPathResponse } = useLearningPath(
    id ?? "",
    { language: editorLanguage },
    { enabled: Boolean(id) && !isCreateMode },
  );
  const learningPath = learningPathResponse?.data ?? loaderLearningPath?.data ?? null;
  const typedLearningPath = learningPath as LearningPathEditorLearningPath | null;
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
    learningPath: typedLearningPath,
    isCreateMode,
    editorLanguage,
  });
  const { canEdit, canUpdateCourses } = useLearningPathEditorPermissions({
    learningPath: typedLearningPath,
    currentUserId: currentUser?.id,
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
  const availableCourses = typedLearningPath?.availableCourseOptions ?? [];
  const pathCourses = typedLearningPath?.courses ?? [];

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminLearningPathsView.breadcrumbs.learningPaths"),
          href: "/admin/learning-paths",
        },
        {
          title: isCreateMode
            ? t("adminLearningPathsView.breadcrumbs.create")
            : t("adminLearningPathsView.breadcrumbs.edit"),
          href: isCreateMode ? "/admin/learning-paths/new" : `/admin/learning-paths/${id}`,
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.ADMIN_EDITOR_PAGE}
      >
        <div className="rounded-[2rem] border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6 md:gap-8">
            <LearningPathEditorDetailsSection
              form={form}
              isCreateMode={isCreateMode}
              coursesCount={typedLearningPath?.courses.length ?? 0}
              editorLanguage={editorLanguage}
              availableLocales={typedLearningPath?.availableLocales}
              baseLanguage={typedLearningPath?.baseLanguage}
              thumbnailUrl={displayThumbnailUrl}
              fileInputRef={fileInputRef}
              onImageUpload={handleImageUpload}
              onRemoveThumbnail={removeThumbnail}
              certificateSignatureUrl={displayCertificateSignatureUrl}
              certificateSignatureFileInputRef={certificateSignatureInputRef}
              onCertificateSignatureUpload={handleCertificateSignatureUpload}
              onRemoveCertificateSignature={removeCertificateSignature}
              onLanguageChange={setEditorLanguage}
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
    </PageWrapper>
  );
}
