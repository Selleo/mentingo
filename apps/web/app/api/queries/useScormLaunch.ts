import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { LaunchScormAttemptResponse } from "../generated-api";

type ScormLaunchParams = {
  lessonId: string;
  scoId?: string | null;
};

export const scormLaunchQueryOptions = ({ lessonId, scoId }: ScormLaunchParams) =>
  queryOptions({
    enabled: Boolean(lessonId),
    queryKey: ["scorm", "launch", lessonId, scoId ?? null],
    queryFn: async () => {
      const response = await ApiClient.api.scormControllerLaunchScormAttempt({
        lessonId,
        scoId: scoId ?? undefined,
      });

      return response.data;
    },
    select: (data: LaunchScormAttemptResponse) => data.data,
  });

export function useScormLaunch(params: ScormLaunchParams) {
  return useQuery(scormLaunchQueryOptions(params));
}
