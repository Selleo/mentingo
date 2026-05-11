import type { LearningPathSchema } from "./learning-path.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { SortEnrolledStudentsOptions } from "src/courses/schemas/courseQuery";
import type { GroupsFilterSchema } from "src/group/group.types";

export type LearningPathEnrolledStudentsQuery = {
  learningPathId: UUIDType;
  keyword?: string;
  sort?: SortEnrolledStudentsOptions;
  groups?: GroupsFilterSchema;
  page?: number;
  perPage?: number;
};

export type LearningPathListQuery = {
  page?: number;
  perPage?: number;
  language?: SupportedLanguages;
  searchQuery?: string;
  visibility?: { canReadAll: boolean; canReadOwn: boolean; studentId: UUIDType };
};

export type LocalizedLearningPath = Omit<LearningPathSchema, "title" | "description"> & {
  title: string;
  description: string;
};
