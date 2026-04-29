import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { PointsService } from "src/gamification/points.service";

@EventsHandler(UserCourseFinishedEvent)
export class UserCourseFinishedPointsHandler implements IEventHandler<UserCourseFinishedEvent> {
  constructor(private readonly pointsService: PointsService) {}

  async handle(event: UserCourseFinishedEvent): Promise<void> {
    const { actor, courseId, userId } = event.courseFinishedData;

    await this.pointsService.award(
      userId,
      POINT_EVENT_TYPES.COURSE_COMPLETED,
      courseId,
      actor.tenantId,
    );
  }
}
