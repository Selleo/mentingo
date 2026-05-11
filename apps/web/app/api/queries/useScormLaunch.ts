import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { LaunchScormAttemptResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

type ScormLaunchParams = {
  lessonId: string;
  scoId?: string | null;
  language: SupportedLanguages;
};

export const scormLaunchQueryOptions = ({ lessonId, scoId, language }: ScormLaunchParams) =>
  queryOptions({
    enabled: Boolean(lessonId),
    queryKey: ["scorm", "launch", lessonId, scoId ?? null, language],
    queryFn: async () => {
      const response = await ApiClient.api.scormControllerLaunchScormAttempt({
        lessonId,
        scoId: scoId ?? undefined,
        language,
      });

      return response.data;
    },
    select: (data: LaunchScormAttemptResponse) => data.data,
  });

export function useScormLaunch(params: ScormLaunchParams) {
  return useQuery(scormLaunchQueryOptions(params));
}
