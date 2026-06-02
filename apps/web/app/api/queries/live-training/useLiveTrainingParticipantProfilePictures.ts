import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

type LiveTrainingParticipantProfilePicturesQueryOptions = {
  enabled?: boolean;
};

export const LIVE_TRAINING_PARTICIPANT_PROFILE_PICTURES_QUERY_KEY = [
  "live-training-participant-profile-pictures",
];

export const liveTrainingParticipantProfilePicturesQueryOptions = (
  liveTrainingId: string | undefined,
  participantUserIds: string[],
  language?: SupportedLanguages,
  options: LiveTrainingParticipantProfilePicturesQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [
      ...LIVE_TRAINING_PARTICIPANT_PROFILE_PICTURES_QUERY_KEY,
      liveTrainingId,
      participantUserIds,
      language,
    ],
    queryFn: async () => {
      if (!liveTrainingId) {
        throw new Error("liveTrainingView.errors.idRequired");
      }

      const response =
        await ApiClient.api.liveTrainingSessionsControllerGetParticipantProfilePictures(
          liveTrainingId,
          { language: language ?? SUPPORTED_LANGUAGES.EN },
        );

      return response.data.data;
    },
    ...options,
  });

export function useLiveTrainingParticipantProfilePictures(
  liveTrainingId: string | undefined,
  participantUserIds: string[],
  language?: SupportedLanguages,
  options?: LiveTrainingParticipantProfilePicturesQueryOptions,
) {
  return useQuery(
    liveTrainingParticipantProfilePicturesQueryOptions(
      liveTrainingId,
      participantUserIds,
      language,
      options,
    ),
  );
}
