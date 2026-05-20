import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import type { SupportedLanguages } from "@repo/shared";
import type { UpdateLiveTrainingBody } from "~/api/generated-api";
import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const toTimeInputValue = (date: Date) =>
  `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const buildDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

export const buildLiveTrainingEditFormState = (
  liveTraining: LiveTrainingDetails,
): LiveTrainingEditFormState => {
  const startsAt = new Date(liveTraining.startsAt);
  const endsAt = new Date(liveTraining.endsAt);

  return {
    title: liveTraining.title,
    description: liveTraining.description ?? "",
    startDate: toDateInputValue(startsAt),
    startTime: toTimeInputValue(startsAt),
    endDate: toDateInputValue(endsAt),
    endTime: toTimeInputValue(endsAt),
    deliveryType: liveTraining.deliveryType,
    location: liveTraining.location ?? "",
    maxParticipants: String(liveTraining.maxParticipants),
    microphoneEnabled: liveTraining.settings.viewerPermissions.microphoneEnabled,
    cameraEnabled: liveTraining.settings.viewerPermissions.cameraEnabled,
  };
};

export const buildUpdateLiveTrainingPayload = (
  formState: LiveTrainingEditFormState,
  timezone: string,
  language: SupportedLanguages,
): UpdateLiveTrainingBody => {
  const isOffline = formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;

  const maxParticipants = Number(formState.maxParticipants);
  const payload: UpdateLiveTrainingBody = {
    title: formState.title.trim(),
    description: formState.description.trim() || null,
    language,
    startsAt: buildDateTime(formState.startDate, formState.startTime).toISOString(),
    endsAt: buildDateTime(formState.endDate, formState.endTime).toISOString(),
    timezone,
    deliveryType: formState.deliveryType,
    location: isOffline ? formState.location.trim() : null,
    settings: {
      viewerPermissions: {
        microphoneEnabled: formState.microphoneEnabled,
        cameraEnabled: formState.cameraEnabled,
      },
    },
  };

  if (formState.maxParticipants.trim()) {
    payload.maxParticipants = maxParticipants;
  }

  return payload;
};

export const isLiveTrainingEditFormDirty = (
  liveTraining: LiveTrainingDetails,
  formState: LiveTrainingEditFormState,
) => JSON.stringify(buildLiveTrainingEditFormState(liveTraining)) !== JSON.stringify(formState);

export const isLiveTrainingEditFormValid = (formState: LiveTrainingEditFormState) => {
  const startsAt = buildDateTime(formState.startDate, formState.startTime);
  const endsAt = buildDateTime(formState.endDate, formState.endTime);

  return (
    Boolean(formState.title.trim()) &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    endsAt > startsAt
  );
};
