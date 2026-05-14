import type { GetLearningPathsResponse } from "~/api/generated-api";

export type LearningPathListItem = GetLearningPathsResponse["data"][number];
export type LearningPathCoursePreview = LearningPathListItem["courses"][number];
export type LearningPathCourseOption = LearningPathListItem["availableCourseOptions"][number];
export type LearningPathCourseOptionMap = ReadonlyMap<
  string,
  LearningPathListItem["availableCourseOptions"]
>;

export type SortableLearningPathCourse = LearningPathCoursePreview & {
  sortableId: string;
};
