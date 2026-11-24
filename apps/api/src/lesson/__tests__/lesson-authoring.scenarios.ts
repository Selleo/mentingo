import { LESSON_TYPES } from "@repo/shared";

import { MAX_LESSON_TITLE_LENGTH } from "src/lesson/repositories/lesson.constants";

export const TOO_LONG_LESSON_TITLE = "x".repeat(MAX_LESSON_TITLE_LENGTH + 1);

export const LESSON_CREATION_REJECTIONS = {
  OTHER_AUTHOR: "the content creator does not own the course",
  TITLE_TOO_LONG: "the title is too long",
  MISSING_CHAPTER: "the chapter does not exist",
} as const;

export type LessonCreationRejection =
  (typeof LESSON_CREATION_REJECTIONS)[keyof typeof LESSON_CREATION_REJECTIONS];

export const LESSON_CREATION_REJECTION_CASES = [
  {
    rejection: LESSON_CREATION_REJECTIONS.OTHER_AUTHOR,
    expectedStatus: 403,
    expectedMessage: "common.toast.noAccess",
  },
  {
    rejection: LESSON_CREATION_REJECTIONS.TITLE_TOO_LONG,
    expectedStatus: 400,
    expectedMessage: "adminCourseView.toast.maxTitleLengthExceeded",
  },
  {
    rejection: LESSON_CREATION_REJECTIONS.MISSING_CHAPTER,
    expectedStatus: 404,
    expectedMessage: "masterCourse.error.chapterNotFound",
  },
];

export const CONTENT_LESSON_BODY = {
  title: "Getting started",
  description: "<p>Welcome to the course.</p>",
  type: LESSON_TYPES.CONTENT,
};

export const QUIZ_LESSON_BODY = {
  title: "Warm-up quiz",
  type: LESSON_TYPES.QUIZ,
  thresholdScore: 50,
  attemptsLimit: null,
  quizCooldownInHours: null,
};

export const EMBED_URL = "https://example.com/embed";
export const UPDATED_EMBED_URL = "https://example.com/embed-updated";
export const ADDED_EMBED_URL = "https://example.com/embed-added";
export const INSECURE_EMBED_URL = "http://example.com/embed";
