import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";

import { ApiClient } from "../api-client";

import type { GetLessonByIdResponse, UpsertProgressBody } from "../generated-api";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

const markLessonCompletedInCache = (
  lessonId: string,
  learningStateId: CourseLearningIdentity["learningStateId"],
) => {
  queryClient.setQueriesData<GetLessonByIdResponse>(
    { queryKey: ["lesson", lessonId] },
    (currentLesson) => {
      if (
        !currentLesson?.data ||
        (currentLesson.data.learningStateId ?? null) !== (learningStateId ?? null)
      )
        return currentLesson;

      return {
        ...currentLesson,
        data: {
          ...currentLesson.data,
          lessonCompleted: true,
        },
      };
    },
  );
};

export const syncLessonVideoCompletionQueries = async (lessonId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["lessons"] }),
    queryClient.invalidateQueries({ queryKey: ["lessonProgress", lessonId] }),
    queryClient.invalidateQueries({ queryKey: ["certificates"] }),
    queryClient.invalidateQueries({ queryKey: ["certificate"] }),
    invalidateLearningPathProgressionData(),
  ]);
};

export const useLessonVideoProgress = () => {
  return useMutation({
    mutationFn: async ({
      learningStateId,
      ...body
    }: UpsertProgressBody & CourseLearningIdentity) => {
      const response = await ApiClient.api.lessonVideoProgressControllerUpsertProgress(
        body,
        courseLearningHeaders(learningStateId),
      );
      return response.data.data;
    },
    onSuccess: (progress, { learningStateId }) => {
      if (!progress.lessonCompleted) return;

      markLessonCompletedInCache(progress.lessonId, learningStateId);
    },
  });
};
