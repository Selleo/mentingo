import { DASHBOARD_CALENDAR_VIEWS } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { getCalendarEventsQuerySchema } from "./get-calendar-events-query.schema";

export const dashboardCalendarViewSchema = Type.Enum(DASHBOARD_CALENDAR_VIEWS);

export const getDashboardCalendarEventsQuerySchema = Type.Object({
  ...getCalendarEventsQuerySchema.properties,
  view: Type.Optional(dashboardCalendarViewSchema),
  selectedDate: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});

export type GetDashboardCalendarEventsQuery = Static<typeof getDashboardCalendarEventsQuerySchema>;
