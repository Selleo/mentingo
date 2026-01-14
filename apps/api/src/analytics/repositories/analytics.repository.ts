import { Inject, Injectable } from "@nestjs/common";
import { countDistinct, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { users, userStatistics } from "src/storage/schema";

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getActiveUsersCount() {
    return this.db
      .select({
        activeUsersCount: countDistinct(users.id),
        timestamp: sql<string>`NOW()`,
      })
      .from(users)
      .innerJoin(userStatistics, eq(userStatistics.userId, users.id))
      .where(isNull(users.deletedAt));
  }
}
