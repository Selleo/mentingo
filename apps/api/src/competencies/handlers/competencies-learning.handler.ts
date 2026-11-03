import { Injectable, type OnModuleInit } from "@nestjs/common";

import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";

import { CompetenciesSyncService } from "../competencies-sync.service";
import { getLearningEventData } from "../utils/competencies-learning-event.utils";

import type { CompetenciesLearningEvent } from "../competencies.types";

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
        this.enqueueLearningEventFacts(
          materializeLegacyEvent(event.name, payload) as CompetenciesLearningEvent,
          eventId,
        ),
      );
  }
  async enqueueLearningEventFacts(event: CompetenciesLearningEvent, eventId: string) {
    const data = getLearningEventData(event);
    await this.competenciesSyncService.enqueueCourseLearningFactsForCurrentTenant(
      data.userId,
      data.courseId,
      data.actor?.tenantId,
      eventId,
    );
  }
}
