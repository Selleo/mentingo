import type { GetEventDetailsResponse } from "~/api/generated-api";

export type CalendarEventDetails = GetEventDetailsResponse["data"];
export type CalendarEventSourceType = CalendarEventDetails["sourceType"];
export type LiveTrainingPayload = Extract<
  CalendarEventDetails["payload"],
  { liveTraining: unknown }
>["liveTraining"];
export type CourseDueDatePayload = Extract<
  CalendarEventDetails["payload"],
  { courseDueDate: unknown }
>["courseDueDate"];
export type OutlookCalendarPayload = Extract<
  CalendarEventDetails["payload"],
  { outlookCalendar: unknown }
>["outlookCalendar"];

export type LiveTrainingCalendarEventDetails = CalendarEventDetails & {
  payload: {
    liveTraining: LiveTrainingPayload;
  };
};

export type CourseDueDateCalendarEventDetails = CalendarEventDetails & {
  payload: {
    courseDueDate: CourseDueDatePayload;
  };
};

export type OutlookCalendarEventDetails = CalendarEventDetails & {
  payload: {
    outlookCalendar: OutlookCalendarPayload;
  };
};
