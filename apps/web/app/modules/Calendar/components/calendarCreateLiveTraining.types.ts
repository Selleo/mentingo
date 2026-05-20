import type { CALENDAR_CREATE_MODES } from "./calendarCreateLiveTraining.constants";
import type { LiveTrainingDeliveryType } from "@repo/shared";

export type CalendarCreateMode = (typeof CALENDAR_CREATE_MODES)[keyof typeof CALENDAR_CREATE_MODES];

export type CalendarCreateLiveTrainingDialogProps = {
  open: boolean;
  selectedRange: CalendarSelectedRange | null;
  timezone: string;
  canCreateLiveTraining: boolean;
  onOpenChange: (open: boolean) => void;
};

export type CalendarSelectedRange = {
  start: Date;
  end: Date | null;
  allDay: boolean;
};

export type CalendarCreateLiveTrainingFormState = {
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  deliveryType: LiveTrainingDeliveryType;
  location: string;
  maxParticipants: number;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
};
