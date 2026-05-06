import { ContentTypes, LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";

import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

export const getContentTypeByLessonType = (lessonType: Lesson["type"]) => {
  switch (lessonType) {
    case LessonType.CONTENT:
      return ContentTypes.CONTENT_LESSON_FORM;
    case LessonType.QUIZ:
      return ContentTypes.QUIZ_FORM;
    case LessonType.AI_MENTOR:
      return ContentTypes.AI_MENTOR_FORM;
    case LessonType.EMBED:
      return ContentTypes.EMBED_FORM;
    case LessonType.SCORM:
      return ContentTypes.SCORM_LESSON_FORM;
    default:
      return ContentTypes.EMPTY;
  }
};
