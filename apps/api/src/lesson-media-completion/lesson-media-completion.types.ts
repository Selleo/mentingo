import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type CompleteLessonWhenRequiredMediaConsumedParams = {
  lessonId: UUIDType;
  language?: SupportedLanguages;
  currentUser: CurrentUserType;
  lessonCompleted: boolean;
  videoCompletionTrackingEnabled: boolean;
  audioCompletionTrackingEnabled: boolean;
};

export type GetRequiredMediaProgressForLessonParams = {
  lessonId: UUIDType;
  studentId: UUIDType;
  resourceEntityIds: UUIDType[];
};
