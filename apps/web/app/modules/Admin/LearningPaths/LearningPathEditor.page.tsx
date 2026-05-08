import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useLocation, useNavigate, useParams } from "@remix-run/react";
import {
  LEARNING_PATH_STATUSES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import {
  useAddCoursesToLearningPath,
  useCreateLearningPath,
  useRemoveCourseFromLearningPath,
  useReorderLearningPathCourses,
  useUpdateLearningPath,
} from "~/api/mutations/useLearningPathMutations";
import { useCurrentUserSuspense } from "~/api/queries";
import { learningPathQueryOptions, useLearningPath } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { useToast } from "~/components/ui/use-toast";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import { LearningPathEditorCoursesSection } from "./components/LearningPathEditorCoursesSection";
import { LearningPathEditorDetailsSection } from "./components/LearningPathEditorDetailsSection";

import type { LearningPathEditorFormValues, LearningPathEditorLearningPath } from "./types";
import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";

const learningPathEditorSchema = z.object({
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  title: z.string().min(1),
  description: z.string(),
  thumbnailReference: z.string().nullable().optional(),
  thumbnail: z.custom<File>().nullable().optional(),
  status: z.nativeEnum(LEARNING_PATH_STATUSES),
  includesCertificate: z.boolean(),
  sequenceEnabled: z.boolean(),
});

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPathEditor");

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  if (!params.id || params.id === "new") return null;

  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathQueryOptions(params.id, { language }));
};

export default function LearningPathEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [displayThumbnailUrl, setDisplayThumbnailUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: learningPathResponse } = useLearningPath(
    id ?? "",
    { language: editorLanguage },
    { enabled: Boolean(id) && !isCreateMode },
  );
  const learningPath = learningPathResponse?.data ?? loaderLearningPath?.data ?? null;

  const form = useForm<LearningPathEditorFormValues>({
    resolver: zodResolver(learningPathEditorSchema),
    mode: "onChange",
    defaultValues: {
      language: editorLanguage,
      title: "",
      description: "",
      thumbnailReference: null,
      thumbnail: null,
      status: LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: false,
      sequenceEnabled: false,
    },
  });

  const { mutateAsync: createLearningPath, isPending: isCreatePending } = useCreateLearningPath();
  const { mutateAsync: updateLearningPath, isPending: isUpdatePending } = useUpdateLearningPath();
  const { mutateAsync: addCoursesToLearningPath, isPending: isAddCoursePending } =
    useAddCoursesToLearningPath();
  const { mutateAsync: removeCourseFromLearningPath, isPending: isRemoveCoursePending } =
    useRemoveCourseFromLearningPath();
  const { mutateAsync: reorderLearningPathCourses, isPending: isReorderPending } =
    useReorderLearningPathCourses();

  const typedLearningPath = learningPath as LearningPathEditorLearningPath | null;
  const isOwnLearningPath = typedLearningPath?.authorId === currentUser?.id;
  const canCreateLearningPaths = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_CREATE);
  const canEdit =
    (isCreateMode && canCreateLearningPaths) ||
    hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE) ||
    (hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE_OWN) && isOwnLearningPath);
  const canUpdateCourses =
    hasPermission(permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE) ||
    (hasPermission(permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN) && isOwnLearningPath);
  const availableCourses = typedLearningPath?.availableCourseOptions ?? [];
  const pathCourses = typedLearningPath?.courses ?? [];
  const isSaving = isCreatePending || isUpdatePending;
  const isCourseMutationPending = isAddCoursePending || isRemoveCoursePending || isReorderPending;

  useEffect(() => {
    form.setValue("language", editorLanguage, { shouldValidate: true });
  }, [editorLanguage, form]);

  useEffect(() => {
    if (!learningPath || isCreateMode) return;

    form.reset({
      language: editorLanguage,
      title: learningPath.title,
      description: learningPath.description,
      thumbnailReference: learningPath.thumbnailReference,
      thumbnail: null,
      status: learningPath.status ?? LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: learningPath.includesCertificate ?? false,
      sequenceEnabled: learningPath.sequenceEnabled ?? false,
    });
    setDisplayThumbnailUrl(learningPath.thumbnailReference ?? null);
  }, [editorLanguage, form, isCreateMode, learningPath]);

  const invalidateLearningPaths = async () => {
    await queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
  };

  const handleImageUpload = (file: File) => {
    form.setValue("thumbnail", file, { shouldValidate: true });
    setDisplayThumbnailUrl(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    form.setValue("thumbnailReference", null, { shouldValidate: true });
    form.setValue("thumbnail", null, { shouldValidate: true });
    setDisplayThumbnailUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (values: LearningPathEditorFormValues) => {
    const { thumbnail, ...baseValues } = values;
    const payload = {
      ...baseValues,
      ...(thumbnail && { thumbnail }),
    };

    if (isCreateMode) {
      const createdLearningPath = await createLearningPath(payload);

      await invalidateLearningPaths();
      toast({ description: t("adminLearningPathsView.toast.created") });
      navigate(`/admin/learning-paths/${createdLearningPath.data.id}`);
      return;
    }

    if (!id) return;

    await updateLearningPath({
      learningPathId: id,
      data: {
        ...payload,
        language: editorLanguage,
      },
    });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.updated") });
  };

  const handleAddCourse = async (courseId: string) => {
    if (!id) return;

    await addCoursesToLearningPath({
      learningPathId: id,
      data: { courseIds: [courseId] },
    });
    await invalidateLearningPaths();
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!id) return;

    await removeCourseFromLearningPath({ learningPathId: id, courseId });
    await invalidateLearningPaths();
  };

  const handleReorderCourses = async (courseIds: string[]) => {
    if (!id) return;

    await reorderLearningPathCourses({
      learningPathId: id,
      data: { courseIds },
    });
    await invalidateLearningPaths();
  };

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
