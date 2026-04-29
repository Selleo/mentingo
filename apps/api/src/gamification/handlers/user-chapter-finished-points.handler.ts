import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { PointsService } from "src/gamification/points.service";

@EventsHandler(UserChapterFinishedEvent)
export class UserChapterFinishedPointsHandler implements IEventHandler<UserChapterFinishedEvent> {
  constructor(private readonly pointsService: PointsService) {}

  async handle(event: UserChapterFinishedEvent): Promise<void> {
    const { actor, chapterId, userId } = event.chapterFinishedData;

    await this.pointsService.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      actor.tenantId,
    );
  }
}
