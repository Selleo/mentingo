export { LESSON_TYPES, type LessonTypes } from "@repo/shared";

export type EmbedLessonResourceType = {
  id: string;
  reference: string;
  contentType: string;
  metadata: {
    allowFullscreen: boolean;
  };
};
