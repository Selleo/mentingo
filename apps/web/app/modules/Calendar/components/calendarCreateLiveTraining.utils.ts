import {
  DEFAULT_LIVE_TRAINING_SETTINGS,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
} from "@repo/shared";

import type {
  CalendarCreateLiveTrainingDialogProps,
  CalendarCreateLiveTrainingFormState,
} from "./calendarCreateLiveTraining.types";
import type { SupportedLanguages } from "@repo/shared";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const toTimeInputValue = (date: Date) =>
  `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const getDefaultDateRange = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
) => {
  const startsAt = selectedRange?.start ? new Date(selectedRange.start) : new Date();

  if (
    !selectedRange ||
    selectedRange.allDay ||
    (startsAt.getHours() === 0 && startsAt.getMinutes() === 0)
  ) {
    startsAt.setHours(9, 0, 0, 0);
  }

  const endsAt = selectedRange?.end ? new Date(selectedRange.end) : new Date(startsAt);

  if (selectedRange?.allDay && selectedRange.end) {
    endsAt.setDate(endsAt.getDate() - 1);
    endsAt.setHours(17, 0, 0, 0);
  }

  if (endsAt <= startsAt) {
    endsAt.setTime(startsAt.getTime());
    endsAt.setHours(startsAt.getHours() + 1);
  }

  return { startsAt, endsAt };
};

export const buildCalendarCreateDateTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00`);

export const buildInitialCalendarCreateLiveTrainingFormState = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
  language: SupportedLanguages,
): CalendarCreateLiveTrainingFormState => {
  const { startsAt, endsAt } = getDefaultDateRange(selectedRange);

  return {
    title: "",
    description: "",
    language,
    startDate: toDateInputValue(startsAt),
    startTime: toTimeInputValue(startsAt),
    endDate: toDateInputValue(endsAt),
    endTime: toTimeInputValue(endsAt),
    deliveryType: LIVE_TRAINING_DELIVERY_TYPES.ONLINE,
    location: "",
    maxParticipants: LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
    microphoneEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.microphoneEnabled,
    cameraEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.cameraEnabled,
  };
};
