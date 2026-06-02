export { LESSON_TYPES, type LessonTypes } from "@repo/shared";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CreateLiveLessonInput = {
  lessonId: UUIDType;
  liveTrainingId: UUIDType;
  liveTrainingLinkId: UUIDType;
  language: SupportedLanguages;
};

export type EmbedLessonResourceType = {
  id: string;
  reference: string;
  contentType: string;
  metadata: {
    allowFullscreen: boolean;
  };
};
