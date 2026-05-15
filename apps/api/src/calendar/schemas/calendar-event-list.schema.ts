import { Type, type Static } from "@sinclair/typebox";

import { baseResponse } from "src/common";

import { calendarEventListItemSchema } from "./calendar-common.schema";

export const calendarEventListSchema = Type.Object({
  events: Type.Array(calendarEventListItemSchema),
});

export const calendarEventListResponseSchema = baseResponse(calendarEventListSchema);

export type CalendarEventListItem = Static<typeof calendarEventListItemSchema>;
export type CalendarEventList = Static<typeof calendarEventListSchema>;
export type CalendarEventListResponse = Static<typeof calendarEventListResponseSchema>;
