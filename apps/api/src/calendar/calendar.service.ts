import { Injectable, NotImplementedException } from "@nestjs/common";

import { CalendarRepository } from "./calendar.repository";

@Injectable()
export class CalendarService {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  getEvents(_query: unknown): never {
    throw new NotImplementedException();
  }

  getEventDetails(_eventId: string): never {
    throw new NotImplementedException();
  }

  getTodayIndicator(): never {
    throw new NotImplementedException();
  }
}
