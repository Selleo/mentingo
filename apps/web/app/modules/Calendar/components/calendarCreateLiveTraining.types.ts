import type { CALENDAR_CREATE_MODES } from "./calendarCreateLiveTraining.constants";
import type { LiveTrainingFormState } from "~/modules/LiveTraining/liveTrainingForm.types";

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

export type CalendarCreateLiveTrainingFormState = LiveTrainingFormState;
