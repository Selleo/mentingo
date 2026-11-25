import type { UUIDType } from "src/common";
import type { LearningTimeStatisticsSortOptions } from "src/learning-time/learning-time.schema";

export type LearningTimeQuery = {
  userId?: UUIDType;
  groupId?: UUIDType;
  page?: number;
  perPage?: number;
  searchQuery?: string;
  sort?: LearningTimeStatisticsSortOptions;
};

export type EnrolledLessonLearningAccess = {
  courseId: UUIDType;
  authorId: UUIDType;
  isLearningModeActive: boolean;
};
