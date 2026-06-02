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
