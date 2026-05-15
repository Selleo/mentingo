import { Controller, Get, Param, Query } from "@nestjs/common";
import { FEATURES } from "@repo/shared";

import { RequireFeature } from "src/common/decorators/require-feature.decorator";

import { CalendarService } from "./calendar.service";

@RequireFeature(FEATURES.CALENDAR)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  getEvents(@Query() query: unknown) {
    return this.calendarService.getEvents(query);
  }

  @Get("events/:eventId")
  getEventDetails(@Param("eventId") eventId: string) {
    return this.calendarService.getEventDetails(eventId);
  }

  @Get("today-indicator")
  getTodayIndicator() {
    return this.calendarService.getTodayIndicator();
  }
}
