import { useNavigate } from "@remix-run/react";

import {
  useAddCoursesToLearningPath,
  useCreateLearningPath,
  useRemoveCourseFromLearningPath,
  useReorderLearningPathCourses,
  useUpdateLearningPath,
} from "~/api/mutations/useLearningPathMutations";

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
  const navigate = useNavigate();
  const { mutateAsync: createLearningPath, isPending: isCreatePending } = useCreateLearningPath();
  const { mutateAsync: updateLearningPath, isPending: isUpdatePending } = useUpdateLearningPath();
  const { mutateAsync: addCoursesToLearningPath, isPending: isAddCoursePending } =
    useAddCoursesToLearningPath();
  const { mutateAsync: removeCourseFromLearningPath, isPending: isRemoveCoursePending } =
    useRemoveCourseFromLearningPath();
  const { mutateAsync: reorderLearningPathCourses, isPending: isReorderPending } =
    useReorderLearningPathCourses();

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

      navigate(`/admin/development-paths/${createdLearningPath.data.id}`);
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
  };

  const handleAddCourse = async (courseId: string) => {
    if (!learningPathId) return;

    await addCoursesToLearningPath({
      learningPathId,
      data: { courseIds: [courseId] },
    });
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!learningPathId) return;

    await removeCourseFromLearningPath({ learningPathId, courseId });
  };

  const handleReorderCourses = async (courseIds: string[]) => {
    if (!learningPathId) return;

    await reorderLearningPathCourses({
      learningPathId,
      data: { courseIds },
    });
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
