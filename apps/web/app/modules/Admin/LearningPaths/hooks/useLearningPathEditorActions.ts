import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import {
  useAddCoursesToLearningPath,
  useCreateLearningPath,
  useRemoveCourseFromLearningPath,
  useReorderLearningPathCourses,
  useUpdateLearningPath,
} from "~/api/mutations/useLearningPathMutations";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { LearningPathEditorFormValues } from "../types";
import type { SupportedLanguages } from "@repo/shared";

type UseLearningPathEditorActionsParams = {
  learningPathId?: string;
  isCreateMode: boolean;
  editorLanguage: SupportedLanguages;
};

export function useLearningPathEditorActions({
  learningPathId,
  isCreateMode,
  editorLanguage,
}: UseLearningPathEditorActionsParams) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutateAsync: createLearningPath, isPending: isCreatePending } = useCreateLearningPath();
  const { mutateAsync: updateLearningPath, isPending: isUpdatePending } = useUpdateLearningPath();
  const { mutateAsync: addCoursesToLearningPath, isPending: isAddCoursePending } =
    useAddCoursesToLearningPath();
  const { mutateAsync: removeCourseFromLearningPath, isPending: isRemoveCoursePending } =
    useRemoveCourseFromLearningPath();
  const { mutateAsync: reorderLearningPathCourses, isPending: isReorderPending } =
    useReorderLearningPathCourses();

  const invalidateLearningPaths = async () => {
    await queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
  };

  const buildPayload = (values: LearningPathEditorFormValues) => {
    const {
      thumbnail,
      certificateSignature,
      certificateFontColor,
      removeCertificateSignature,
      ...baseValues
    } = values;

    return {
      ...baseValues,
      ...(thumbnail && { thumbnail }),
      ...(certificateSignature && { certificateSignature }),
      settings: {
        certificateFontColor: certificateFontColor ?? null,
        removeCertificateSignature: removeCertificateSignature ?? false,
      },
    };
  };

  const handleSubmit = async (values: LearningPathEditorFormValues) => {
    const payload = buildPayload(values);

    if (isCreateMode) {
      const createdLearningPath = await createLearningPath(payload);

      await invalidateLearningPaths();
      toast({ description: t("adminLearningPathsView.toast.created") });
      navigate(`/admin/learning-paths/${createdLearningPath.data.id}`);
      return;
    }

    if (!learningPathId) return;

    await updateLearningPath({
      learningPathId,
      data: {
        ...payload,
        language: editorLanguage,
      },
    });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.updated") });
  };

  const handleAddCourse = async (courseId: string) => {
    if (!learningPathId) return;

    await addCoursesToLearningPath({
      learningPathId,
      data: { courseIds: [courseId] },
    });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.coursesAdded") });
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!learningPathId) return;

    await removeCourseFromLearningPath({ learningPathId, courseId });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.courseRemoved") });
  };

  const handleReorderCourses = async (courseIds: string[]) => {
    if (!learningPathId) return;

    await reorderLearningPathCourses({
      learningPathId,
      data: { courseIds },
    });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.coursesReordered") });
  };

  return {
    handleSubmit,
    handleAddCourse,
    handleRemoveCourse,
    handleReorderCourses,
    isSaving: isCreatePending || isUpdatePending,
    isCourseMutationPending: isAddCoursePending || isRemoveCoursePending || isReorderPending,
  };
}
