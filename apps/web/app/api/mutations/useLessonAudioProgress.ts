import { useMutation } from "@tanstack/react-query";

import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";

import { ApiClient } from "../api-client";

import { markLessonCompletedInCache } from "./useLessonVideoProgress";

import type { UpsertLessonAudioProgressBody } from "../generated-api";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export const useLessonAudioProgress = () => {
  return useMutation({
    mutationFn: async ({
      learningStateId,
      ...body
    }: UpsertLessonAudioProgressBody & CourseLearningIdentity) => {
      const response = await ApiClient.api.lessonAudioProgressControllerUpsertLessonAudioProgress(
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
