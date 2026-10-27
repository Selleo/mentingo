import { queryOptions, useQuery } from "@tanstack/react-query";

import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";

import { ApiClient } from "../api-client";

import type { LaunchScormAttemptResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

type ScormLaunchParams = {
  learningStateId?: string | null;
  lessonId: string;
  scoId?: string | null;
  language: SupportedLanguages;
};

export const scormLaunchQueryOptions = ({
  lessonId,
  scoId,
  language,
  learningStateId,
}: ScormLaunchParams) =>
  queryOptions({
    enabled: Boolean(lessonId),
    queryKey: ["scorm", "launch", lessonId, scoId ?? null, language, learningStateId ?? null],
    queryFn: async () => {
      const response = await ApiClient.api.scormControllerLaunchScormAttempt(
        {
          lessonId,
          scoId: scoId ?? undefined,
          language,
        },
        courseLearningHeaders(learningStateId),
      );

      return response.data;
    },
    select: (data: LaunchScormAttemptResponse) => data.data,
  });

export function useScormLaunch(params: ScormLaunchParams) {
  return useQuery(scormLaunchQueryOptions(params));
}
