import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { courseChatMessages } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class DiscussionNotificationsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findThreadParticipantIds(threadId: UUIDType): Promise<UUIDType[]> {
    const participants = await this.db
      .selectDistinct({ userId: courseChatMessages.userId })
      .from(courseChatMessages)
      .where(and(eq(courseChatMessages.threadId, threadId), isNull(courseChatMessages.deletedAt)));

    return participants.map(({ userId }) => userId);
  }
}
