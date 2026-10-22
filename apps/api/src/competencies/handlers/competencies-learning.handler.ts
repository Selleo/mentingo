import { Injectable, type OnModuleInit } from "@nestjs/common";

import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";

import { CompetenciesSyncService } from "../competencies-sync.service";

@Injectable()
export class CompetenciesLearningHandler implements OnModuleInit {
  constructor(
    private readonly competenciesSyncService: CompetenciesSyncService,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
  ) {}
  onModuleInit() {
    for (const event of [
      LessonCompletedEvent,
      LessonProgressChangedEvent,
      UserCourseFinishedEvent,
      LearningSourceWithdrawnEvent,
    ])
      this.outboxDirectHandlerService.registerReaction(event.name, (payload, eventId) =>
        this.handle(
          materializeLegacyEvent(event.name, payload) as
            | LessonCompletedEvent
            | LessonProgressChangedEvent
            | UserCourseFinishedEvent
            | LearningSourceWithdrawnEvent,
          eventId,
        ),
      );
  }
  async handle(
    event:
      | LessonCompletedEvent
      | LessonProgressChangedEvent
      | UserCourseFinishedEvent
      | LearningSourceWithdrawnEvent,
    eventId: string,
  ) {
    let data: Pick<LessonProgressChangedEvent["data"], "userId" | "courseId" | "actor">;
    if (event instanceof LessonCompletedEvent) data = event.lessonCompletionData;
    else if (event instanceof LessonProgressChangedEvent) data = event.data;
    else if (event instanceof UserCourseFinishedEvent) data = event.courseFinishedData;
    else data = event.data;
    await this.competenciesSyncService.enqueueCurrent(
      data.userId,
      data.courseId,
      data.actor?.tenantId,
      eventId,
    );
  }
}
