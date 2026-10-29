import type { CourseStatisticsExpressionsParams } from "../course.types";
import type {
  CourseStudentAiMentorResultsSortField,
  CourseStudentProgressionSortField,
  CourseStudentQuizResultsSortField,
} from "../schemas/courseQuery";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type CourseStatisticsLearnerScope = {
  restricted: boolean;
  userIds: UUIDType[];
};

export type CourseStatisticsSortField =
  | CourseStudentProgressionSortField
  | CourseStudentQuizResultsSortField
  | CourseStudentAiMentorResultsSortField;

export type CourseStatisticsListFilters = CourseStatisticsExpressionsParams & {
  currentUser: CurrentUserType;
  searchQuery: string;
  learnerScope: CourseStatisticsLearnerScope;
};

export type CourseStudentQuizResultsFilters = CourseStatisticsListFilters & {
  quizId: UUIDType | "";
};

export type CourseStudentAiMentorResultsFilters = CourseStatisticsListFilters & {
  lessonId: UUIDType | "";
};

export type CourseStatisticsPageOptions = {
  page: number;
  perPage: number;
  sort: string;
};
