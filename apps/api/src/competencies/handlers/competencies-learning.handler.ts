import { Injectable } from "@nestjs/common";

import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { CompetenciesSyncService } from "../competencies-sync.service";
import { getLearningEventData } from "../utils/competencies-learning-event.utils";

import type { CompetenciesLearningEvent } from "../competencies.types";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(
  LessonCompletedEvent,
  LessonProgressChangedEvent,
  UserCourseFinishedEvent,
  LearningSourceWithdrawnEvent,
)
export class CompetenciesLearningHandler
  implements OutboxEventsHandlerOf<CompetenciesLearningEvent>
{
  constructor(private readonly competenciesSyncService: CompetenciesSyncService) {}

  async handleOutboxEvent(event: CompetenciesLearningEvent, { eventId }: OutboxDeliveryContext) {
    await this.enqueueLearningEventFacts(event, eventId);
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
