import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { COMPETENCIES_JOB_OPERATIONS } from "../competencies.constants";

export const competenciesJobSchema = Type.Object(
  {
    operation: Type.Literal(COMPETENCIES_JOB_OPERATIONS.SYNC),
    tenantId: UUIDSchema,
    subjectId: UUIDSchema,
    courseId: UUIDSchema,
  },
  { additionalProperties: false },
);

export type CompetenciesJobData = Static<typeof competenciesJobSchema>;
