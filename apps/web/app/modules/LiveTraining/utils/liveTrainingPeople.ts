import { LIVE_TRAINING_PERSON_ROLES } from "~/modules/LiveTraining/liveTraining.types";
import { getPersonDisplayName } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type { GetHostCandidatesResponse } from "~/api/generated-api";
import type {
  LiveTrainingDetails,
  LiveTrainingPersonListItem,
} from "~/modules/LiveTraining/liveTraining.types";

export type LiveTrainingHostCandidate = GetHostCandidatesResponse["data"][number];

export const getUserCandidateDisplayName = (user: LiveTrainingHostCandidate) =>
  user.fullName || user.email;

export const getLiveTrainingPeopleList = (
  liveTraining: LiveTrainingDetails,
  fallbackName: string,
) => {
  const peopleById = new Map<string, LiveTrainingPersonListItem>();
  const authorName = getPersonDisplayName(liveTraining.author, fallbackName);

  peopleById.set(liveTraining.author.id, {
    id: liveTraining.author.id,
    name: authorName,
    profilePictureUrl: liveTraining.author.profilePictureUrl,
    roles: [LIVE_TRAINING_PERSON_ROLES.AUTHOR],
  });

  for (const host of liveTraining.hosts) {
    const existingPerson = peopleById.get(host.id);

    if (existingPerson) {
      if (!existingPerson.roles.includes(LIVE_TRAINING_PERSON_ROLES.HOST)) {
        existingPerson.roles.push(LIVE_TRAINING_PERSON_ROLES.HOST);
      }

      continue;
    }

    peopleById.set(host.id, {
      id: host.id,
      name: getPersonDisplayName(host, fallbackName),
      profilePictureUrl: host.profilePictureUrl,
      roles: [LIVE_TRAINING_PERSON_ROLES.HOST],
    });
  }

  return [...peopleById.values()];
};

export const getLiveTrainingEditableHostIds = (liveTraining: LiveTrainingDetails) =>
  liveTraining.hosts.map((host) => host.id).filter((hostId) => hostId !== liveTraining.author.id);
