import { queryOptions, useQuery } from "@tanstack/react-query";

import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";

import { ApiClient } from "../api-client";

import type { LaunchScormPreviewResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

type ScormLaunchParams = {
  learningStateId?: string | null;
  lessonId: string;
  scoId?: string | null;
  language: SupportedLanguages;
  isPreview?: boolean;
};

export type ScormLaunch = LaunchScormPreviewResponse["data"] & {
  attemptId: string | null;
  learningStateId?: string | null;
};

export const scormLaunchQueryOptions = ({
  lessonId,
  scoId,
  language,
  learningStateId,
  isPreview = false,
}: ScormLaunchParams) =>
  queryOptions({
    enabled: Boolean(lessonId),
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: [
      "scorm",
      "launch",
      lessonId,
      scoId ?? null,
      language,
      learningStateId ?? null,
      isPreview,
    ],
    queryFn: async (): Promise<ScormLaunch> => {
      const query = { lessonId, scoId: scoId ?? undefined, language };

      if (isPreview) {
        const response = await ApiClient.api.scormControllerLaunchScormPreview(query);
        return { ...response.data.data, attemptId: null };
      }

      const response = await ApiClient.api.scormControllerLaunchScormAttempt(
        query,
        courseLearningHeaders(learningStateId),
      );

      return response.data.data;
    },
  });

export function useScormLaunch(params: ScormLaunchParams) {
  return useQuery(scormLaunchQueryOptions(params));
}
