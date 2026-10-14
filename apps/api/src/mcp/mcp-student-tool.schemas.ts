import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

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
