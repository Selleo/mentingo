import {
  DEFAULT_LIVE_TRAINING_SETTINGS,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
} from "@repo/shared";

import type {
  CalendarCreateLiveTrainingDialogProps,
  CalendarCreateLiveTrainingFormState,
} from "./calendarCreateLiveTraining.types";
import type { LiveTrainingDeliveryType } from "@repo/shared";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const toTimeInputValue = (date: Date) =>
  `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const getDefaultDateRange = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
) => {
  const startsAt = selectedRange?.start ? new Date(selectedRange.start) : new Date();
  const isAllDay = Boolean(selectedRange?.allDay);

  if (!selectedRange || isAllDay || (startsAt.getHours() === 0 && startsAt.getMinutes() === 0)) {
    startsAt.setHours(9, 0, 0, 0);
  }

  const endsAt = selectedRange?.end ? new Date(selectedRange.end) : new Date(startsAt);

  if (isAllDay && selectedRange?.end) {
    endsAt.setDate(endsAt.getDate() - 1);
    endsAt.setHours(17, 0, 0, 0);
  }

  if (endsAt <= startsAt) {
    endsAt.setTime(startsAt.getTime());
    endsAt.setHours(startsAt.getHours() + 1);
  }

  return { startsAt, endsAt, isAllDay };
};

export const buildCalendarCreateDateTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00`);

export const buildCalendarCreateAllDayStartDateTime = (date: string) =>
  new Date(`${date}T00:00:00`);

export const buildCalendarCreateAllDayEndDateTime = (date: string) => {
  const endsAt = new Date(`${date}T00:00:00`);
  endsAt.setDate(endsAt.getDate() + 1);

  return endsAt;
};

export const buildInitialCalendarCreateLiveTrainingFormState = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
  deliveryType: LiveTrainingDeliveryType = LIVE_TRAINING_DELIVERY_TYPES.ONLINE,
): CalendarCreateLiveTrainingFormState => {
  const { startsAt, endsAt, isAllDay } = getDefaultDateRange(selectedRange);

  return {
    title: "",
    description: "",
    allDay: isAllDay,
    startDate: toDateInputValue(startsAt),
    startTime: toTimeInputValue(startsAt),
    endDate: toDateInputValue(endsAt),
    endTime: toTimeInputValue(endsAt),
    deliveryType,
    location: "",
    maxParticipants: LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
    microphoneEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.microphoneEnabled,
    cameraEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.cameraEnabled,
  };
};
