import { CALENDAR_EVENT_SOURCE_TYPES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const dashboardCalendarEventListItemSchema = Type.Object({
  id: UUIDSchema,
  sourceType: Type.Enum(CALENDAR_EVENT_SOURCE_TYPES),
  targetId: UUIDSchema,
  title: Type.String(),
  startsAt: Type.String(),
  allDay: Type.Boolean(),
});

export const dashboardCalendarEventListSchema = Type.Array(dashboardCalendarEventListItemSchema);

export type DashboardCalendarEventListItem = Static<typeof dashboardCalendarEventListItemSchema>;
export type DashboardCalendarEventList = Static<typeof dashboardCalendarEventListSchema>;
