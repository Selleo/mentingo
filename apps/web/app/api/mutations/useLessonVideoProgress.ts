import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/api/queryClient";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";

import { ApiClient } from "../api-client";

import type { GetLessonByIdResponse, UpsertProgressBody } from "../generated-api";

const markLessonCompletedInCache = (lessonId: string) => {
  queryClient.setQueriesData<GetLessonByIdResponse>(
    { queryKey: ["lesson", lessonId] },
    (currentLesson) => {
      if (!currentLesson?.data) return currentLesson;

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
    queryClient.invalidateQueries({ queryKey: ["lessonProgress", lessonId] }),
    queryClient.invalidateQueries({ queryKey: ["certificates"] }),
    queryClient.invalidateQueries({ queryKey: ["certificate"] }),
    invalidateLearningPathProgressionData(),
  ]);
};

export const useLessonVideoProgress = () => {
  return useMutation({
    mutationFn: async (body: UpsertProgressBody) => {
      const response = await ApiClient.api.lessonVideoProgressControllerUpsertProgress(body);
      return response.data.data;
    },
    onSuccess: (progress) => {
      if (!progress.lessonCompleted) return;

      markLessonCompletedInCache(progress.lessonId);
    },
  });
};
