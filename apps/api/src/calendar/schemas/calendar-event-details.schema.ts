import { baseResponse } from "src/common";

import { calendarEventDetailsItemSchema } from "./calendar-common.schema";

import type { Static } from "@sinclair/typebox";

export const calendarEventDetailsSchema = calendarEventDetailsItemSchema;

export const calendarEventDetailsResponseSchema = baseResponse(calendarEventDetailsSchema);

export type CalendarEventDetails = Static<typeof calendarEventDetailsSchema>;
export type CalendarEventDetailsResponse = Static<typeof calendarEventDetailsResponseSchema>;
