import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserAiMentorLessonPassedEvent } from "src/events/user/user-ai-mentor-lesson-passed.event";
import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { PointsService } from "src/gamification/points.service";

@EventsHandler(UserAiMentorLessonPassedEvent)
export class UserAiMentorLessonPassedPointsHandler
  implements IEventHandler<UserAiMentorLessonPassedEvent>
{
  constructor(private readonly pointsService: PointsService) {}

  async handle(event: UserAiMentorLessonPassedEvent): Promise<void> {
    const { actor, lessonId, userId } = event.lessonPassedData;

    await this.pointsService.award(
      userId,
      POINT_EVENT_TYPES.AI_MENTOR_PASSED,
      lessonId,
      actor.tenantId,
    );
  }
}
