import { LESSON_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

export const COURSE_AUTHORSHIPS = {
  OWN: "own course",
  OTHER_AUTHOR: "another author's course",
} as const;

export type CourseAuthorship = (typeof COURSE_AUTHORSHIPS)[keyof typeof COURSE_AUTHORSHIPS];

export const STUDENT_MODE_ALLOWED_CASES = [
  { role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR, authorship: COURSE_AUTHORSHIPS.OWN },
  { role: SYSTEM_ROLE_SLUGS.ADMIN, authorship: COURSE_AUTHORSHIPS.OWN },
  { role: SYSTEM_ROLE_SLUGS.ADMIN, authorship: COURSE_AUTHORSHIPS.OTHER_AUTHOR },
];

export const STUDENT_MODE_FORBIDDEN_ROLES = [
  { role: SYSTEM_ROLE_SLUGS.STUDENT },
  { role: SYSTEM_ROLE_SLUGS.TRAINER },
];

export const STUDENT_MODE_COURSE_CONTENT = [
  { lessonTypes: [LESSON_TYPES.QUIZ, LESSON_TYPES.CONTENT] },
  { lessonTypes: [] },
];
