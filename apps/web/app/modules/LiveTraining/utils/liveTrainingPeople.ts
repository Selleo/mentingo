import { LIVE_TRAINING_PERSON_ROLES } from "~/modules/LiveTraining/liveTraining.types";
import { getPersonDisplayName } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type { GetUsersResponse } from "~/api/generated-api";
import type {
  LiveTrainingDetails,
  LiveTrainingPersonListItem,
} from "~/modules/LiveTraining/liveTraining.types";

export type LiveTrainingTrainerCandidate = GetUsersResponse["data"][number];

export const getUserCandidateDisplayName = (user: LiveTrainingTrainerCandidate) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return fullName || user.email;
};

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

  for (const trainer of liveTraining.trainers) {
    const existingPerson = peopleById.get(trainer.id);

    if (existingPerson) {
      if (!existingPerson.roles.includes(LIVE_TRAINING_PERSON_ROLES.TRAINER)) {
        existingPerson.roles.push(LIVE_TRAINING_PERSON_ROLES.TRAINER);
      }

      continue;
    }

    peopleById.set(trainer.id, {
      id: trainer.id,
      name: getPersonDisplayName(trainer, fallbackName),
      profilePictureUrl: trainer.profilePictureUrl,
      roles: [LIVE_TRAINING_PERSON_ROLES.TRAINER],
    });
  }

  return [...peopleById.values()];
};

export const getLiveTrainingEditableTrainerIds = (liveTraining: LiveTrainingDetails) =>
  liveTraining.trainers
    .map((trainer) => trainer.id)
    .filter((trainerId) => trainerId !== liveTraining.author.id);
