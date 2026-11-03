import { match, P } from "ts-pattern";

import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";

import type {
  CompetenciesLearningEvent,
  CompetenciesLearningEventData,
} from "../competencies.types";

export function getLearningEventData(
  event: CompetenciesLearningEvent,
): CompetenciesLearningEventData {
  return match(event)
    .with(P.instanceOf(LessonCompletedEvent), ({ lessonCompletionData }) => lessonCompletionData)
    .with(P.instanceOf(UserCourseFinishedEvent), ({ courseFinishedData }) => courseFinishedData)
    .with(
      P.instanceOf(LessonProgressChangedEvent),
      P.instanceOf(LearningSourceWithdrawnEvent),
      ({ data }) => data,
    )
    .exhaustive();
}
