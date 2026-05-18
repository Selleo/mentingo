import type { LiveTrainingDeliveryType, SupportedLanguages } from "@repo/shared";

export const CALENDAR_CREATE_MODES = {
  MENU: "menu",
  LIVE_TRAINING: "live-training",
} as const;

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
  language: SupportedLanguages;
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
