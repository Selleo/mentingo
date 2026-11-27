import { Injectable } from "@nestjs/common";

import { GoogleCalendarApiClient } from "../clients/google-calendar-api.client";
import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";

import { CalendarTokenEncryptionService } from "./calendar-token-encryption.service";

import type { CalendarConnection } from "../types/calendar-connection.types";

@Injectable()
export class GoogleCalendarAccessTokenService {
  constructor(
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly googleCalendarApiClient: GoogleCalendarApiClient,
    private readonly calendarTokenEncryptionService: CalendarTokenEncryptionService,
  ) {}

  async getAccessToken(connection: CalendarConnection) {
    const refreshToken = this.calendarTokenEncryptionService.decrypt(connection);
    const token = await this.googleCalendarApiClient.refreshAccessToken(refreshToken);

    if (token.refresh_token && token.refresh_token !== refreshToken) {
      await this.calendarConnectionRepository.updateConnection(
        connection.id,
        this.calendarTokenEncryptionService.encrypt(token.refresh_token),
      );
    }

    return token.access_token;
  }
}
