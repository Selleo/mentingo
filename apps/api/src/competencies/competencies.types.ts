import type { createCompetenciesClient, LearningFactScopes } from "@mentingo/competencies-sdk";
import type { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import type { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import type { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import type { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";

export type { CompetenciesJobData } from "./schemas/competencies-job.schema";

export type CompetenciesClient = ReturnType<typeof createCompetenciesClient>;
export type CompetenciesLearningScope = LearningFactScopes["pairs"][number];

export type CompetenciesLearningEvent =
  | LessonCompletedEvent
  | LessonProgressChangedEvent
  | UserCourseFinishedEvent
  | LearningSourceWithdrawnEvent;

export type CompetenciesLearningEventData = Pick<
  LessonProgressChangedEvent["data"],
  "userId" | "courseId" | "actor"
>;

export type CompetenciesConnectionSettings = {
  apiKey: string | undefined;
  baseURL: string | undefined;
};
