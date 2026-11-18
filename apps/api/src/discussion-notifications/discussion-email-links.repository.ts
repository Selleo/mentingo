import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { users } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class DiscussionEmailLinksRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findActiveUserIdByEmail(email: string): Promise<UUIDType | null> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt), eq(users.archived, false)))
      .limit(1);

    return user?.id ?? null;
  }

  async isActiveUser(userId: UUIDType): Promise<boolean> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.archived, false)))
      .limit(1);

    return Boolean(user);
  }
}
