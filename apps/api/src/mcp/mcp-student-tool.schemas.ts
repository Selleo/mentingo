import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { CloneType, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";

const language = Type.Enum(SUPPORTED_LANGUAGES);
const page = Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, default: 1 }));
const pageSize = Type.Optional(Type.Integer({ minimum: 1, maximum: 25, default: 10 }));
const query = Type.Optional(Type.String({ minLength: 1, maxLength: 200 }));

export const listStudentCoursesInputSchema = Type.Object(
  {
    language,
    scope: Type.Union([
      Type.Literal(COURSE_ENROLLMENT_SCOPES.AVAILABLE),
      Type.Literal(COURSE_ENROLLMENT_SCOPES.ENROLLED),
    ]),
    page,
    pageSize,
    query,
  },
  { additionalProperties: false },
);
export const listStudentContentInputSchema = Type.Object(
  { language, page, pageSize, query },
  { additionalProperties: false },
);
// News uses the existing learner API's fixed page size and publication order.
export const listStudentNewsInputSchema = Type.Object(
  { language, page },
  { additionalProperties: false },
);
export const getStudentContentInputSchema = Type.Object(
  { id: UUIDSchema, language },
  { additionalProperties: false },
);

export const getStudentCourseInputSchema = Type.Object(
  { courseId: UUIDSchema, language },
  { additionalProperties: false },
);
export const getStudentQaInputSchema = Type.Object(
  { qaId: UUIDSchema, language },
  { additionalProperties: false },
);

export const listStudentChaptersInputSchema = Type.Object(
  { courseId: UUIDSchema, language },
  { additionalProperties: false },
);
export const getStudentChapterInputSchema = Type.Object(
  { courseId: UUIDSchema, chapterId: UUIDSchema, language },
  { additionalProperties: false },
);
export const listStudentLessonsInputSchema = Type.Object(
  { courseId: UUIDSchema, chapterId: UUIDSchema, language, page, pageSize, query },
  { additionalProperties: false },
);
export const getStudentLessonInputSchema = Type.Object(
  {
    courseId: CloneType(UUIDSchema, {
      description: "Course ID from the selected lesson's search or list result.",
    }),
    chapterId: Type.Optional(
      CloneType(UUIDSchema, {
        description:
          "Optional chapter filter. Omit when unknown, including after global_search; never invent an ID or send an all-zero placeholder.",
      }),
    ),
    lessonId: CloneType(UUIDSchema, {
      description: "ID of the selected lesson from global_search, search_lessons or list_lessons.",
    }),
    language,
  },
  { additionalProperties: false },
);
export const searchStudentLessonsInputSchema = Type.Object(
  {
    courseId: Type.Optional(UUIDSchema),
    language,
    query: Type.String({ minLength: 1, maxLength: 200 }),
    page,
    pageSize,
  },
  { additionalProperties: false },
);
