import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  calendarEventDetailsResponseSchema,
  type CalendarEventDetails,
} from "./schemas/calendar-event-details.schema";
import {
  calendarEventListResponseSchema,
  type CalendarEventList,
} from "./schemas/calendar-event-list.schema";
import {
  dashboardCalendarEventListSchema,
  type DashboardCalendarEventList,
} from "./schemas/dashboard-calendar-event-list.schema";
import {
  getCalendarEventsQuerySchema,
  type GetCalendarEventsQuery,
} from "./schemas/get-calendar-events-query.schema";
import { CalendarService } from "./services/calendar.service";

@UseGuards(PermissionsGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  @RequirePermission(PERMISSIONS.CALENDAR_READ)
  @Validate({
    request: [
      { type: "query", name: "start", schema: getCalendarEventsQuerySchema.properties.start },
      { type: "query", name: "end", schema: getCalendarEventsQuerySchema.properties.end },
      {
        type: "query",
        name: "language",
        schema: getCalendarEventsQuerySchema.properties.language,
      },
      {
        type: "query",
        name: "timezone",
        schema: getCalendarEventsQuerySchema.properties.timezone,
      },
    ],
    response: calendarEventListResponseSchema,
  })
  async getEvents(
    @Query("start") start: GetCalendarEventsQuery["start"],
    @Query("end") end: GetCalendarEventsQuery["end"],
    @Query("language") language: GetCalendarEventsQuery["language"],
    @Query("timezone") timezone: GetCalendarEventsQuery["timezone"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CalendarEventList>> {
    const events = await this.calendarService.getEvents(
      {
        start,
        end,
        language,
        timezone,
      },
      currentUser,
    );

    return new BaseResponse(events);
  }

  @Get("dashboard/events")
  @RequirePermission(PERMISSIONS.CALENDAR_READ)
  @Validate({
    request: [
      { type: "query", name: "start", schema: getCalendarEventsQuerySchema.properties.start },
      { type: "query", name: "end", schema: getCalendarEventsQuerySchema.properties.end },
      {
        type: "query",
        name: "language",
        schema: getCalendarEventsQuerySchema.properties.language,
      },
      {
        type: "query",
        name: "timezone",
        schema: getCalendarEventsQuerySchema.properties.timezone,
      },
    ],
    response: baseResponse(dashboardCalendarEventListSchema),
  })
  async getDashboardEvents(
    @Query("start") start: GetCalendarEventsQuery["start"],
    @Query("end") end: GetCalendarEventsQuery["end"],
    @Query("language") language: GetCalendarEventsQuery["language"],
    @Query("timezone") timezone: GetCalendarEventsQuery["timezone"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardCalendarEventList>> {
    return new BaseResponse(
      await this.calendarService.getDashboardEvents(
        { start, end, language, timezone },
        currentUser,
      ),
    );
  }

  @Get("events/:eventId")
  @RequirePermission(PERMISSIONS.CALENDAR_READ)
  @Validate({
    request: [
      { type: "param", name: "eventId", schema: UUIDSchema },
      {
        type: "query",
        name: "language",
        schema: getCalendarEventsQuerySchema.properties.language,
      },
    ],
    response: calendarEventDetailsResponseSchema,
  })
  async getEventDetails(
    @Param("eventId") eventId: UUIDType,
    @Query("language") language: GetCalendarEventsQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CalendarEventDetails>> {
    const eventDetails = await this.calendarService.getEventDetails(eventId, language, currentUser);

    return new BaseResponse(eventDetails);
  }
}
