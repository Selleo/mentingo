import type { SupportedLanguages } from "@repo/shared";
import type { GetLearningPathByIdResponse, GetLearningPathsResponse } from "~/api/generated-api";

export type LearningPathEditorLearningPath = GetLearningPathByIdResponse["data"];
export type LearningPathListItem = GetLearningPathsResponse["data"][number];
export type LearningPathEditorCourse = LearningPathEditorLearningPath["courses"][number] & {
  title?: string;
  thumbnailUrl?: string | null;
};
export type LearningPathEditorCourseOption =
  LearningPathEditorLearningPath["availableCourseOptions"][number];

export type LearningPathEditorStatus = "draft" | "published" | "private";
export type LearningPathEditorFormValues = {
  language: SupportedLanguages;
  title: string;
  description: string;
  thumbnailReference: string | null;
  thumbnail?: File | null;
  status: LearningPathEditorStatus;
  includesCertificate: boolean;
  sequenceEnabled: boolean;
};
