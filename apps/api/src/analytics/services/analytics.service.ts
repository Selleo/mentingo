import { Injectable } from "@nestjs/common";

import { AnalyticsRepository } from "src/analytics/repositories/analytics.repository";

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * Retrieves the count of all active users and the timestamp of the fetch.
   * An active user is defined as a non-deleted account that has logged in at least once.
   * Returns: The number of active users and the current timestamp.
   */
  async getActiveUsersCount() {
    const [activeUsersCount] = await this.analyticsRepository.getActiveUsersCount();

    return activeUsersCount;
  }
}
