import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { enrolledCourseGroupsPayload } from "src/courses/schemas/course.schema";
import { createCoursesEnrollmentSchema } from "src/courses/schemas/createCoursesEnrollment";
import { INTEGRATION_TRAINING_RESULTS_SCOPES } from "src/integration/integration.types";

import type { createUserSchema } from "src/user/schemas/createUser.schema";
import type { updateUserSchema } from "src/user/schemas/updateUser.schema";

export const setUserGroupsSchema = Type.Object({
  groupIds: Type.Array(UUIDSchema),
});

export const integrationDeleteUserResponseSchema = Type.Object({
  message: Type.String(),
});

export const integrationMessageResponseSchema = Type.Object({
  message: Type.String(),
});

export const integrationTenantSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  host: Type.String(),
});

export const integrationTenantsSchema = Type.Array(integrationTenantSchema);

export const integrationTrainingResultsScopeSchema = Type.Union([
  Type.Literal(INTEGRATION_TRAINING_RESULTS_SCOPES.TENANT),
  Type.Literal(INTEGRATION_TRAINING_RESULTS_SCOPES.STUDENT),
  Type.Literal(INTEGRATION_TRAINING_RESULTS_SCOPES.COURSE),
]);

export const integrationTrainingResultSchema = Type.Object({
  scope: integrationTrainingResultsScopeSchema,
  tenantId: UUIDSchema,
  student: Type.Object({
    id: UUIDSchema,
    email: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    fullName: Type.String(),
  }),
  courses: Type.Array(
    Type.Object({
      id: UUIDSchema,
      title: Type.String(),
      lessons: Type.Array(
        Type.Object({
          lessonId: UUIDSchema,
          chapterId: UUIDSchema,
          title: Type.String(),
          type: Type.String(),
          completed: Type.Boolean(),
          completedAt: Type.Union([Type.String(), Type.Null()]),
        }),
      ),
      quizzes: Type.Array(
        Type.Object({
          lessonId: UUIDSchema,
          chapterId: UUIDSchema,
          title: Type.String(),
          score: Type.Union([Type.Number(), Type.Null()]),
          passed: Type.Union([Type.Boolean(), Type.Null()]),
          attempts: Type.Union([Type.Number(), Type.Null()]),
          completedAt: Type.Union([Type.String(), Type.Null()]),
        }),
      ),
      certificate: Type.Object({
        enabled: Type.Boolean(),
        status: Type.Union([
          Type.Literal("issued"),
          Type.Literal("not_issued"),
          Type.Literal("not_applicable"),
        ]),
        issuedAt: Type.Union([Type.String(), Type.Null()]),
      }),
    }),
  ),
});

export const integrationTrainingResultsSchema = Type.Array(integrationTrainingResultSchema);

export const unenrollUsersPayloadSchema = createCoursesEnrollmentSchema;
export const enrollUsersPayloadSchema = createCoursesEnrollmentSchema;

export const enrollGroupsPayloadSchema = enrolledCourseGroupsPayload;
export const unenrollGroupsPayloadSchema = Type.Object({
  groupIds: Type.Array(UUIDSchema),
});

export type IntegrationCreateUserBody = Static<typeof createUserSchema>;
export type IntegrationUpdateUserBody = Static<typeof updateUserSchema>;
export type SetUserGroupsBody = Static<typeof setUserGroupsSchema>;
export type IntegrationTenant = Static<typeof integrationTenantSchema>;
export type EnrollUsersPayload = Static<typeof enrollUsersPayloadSchema>;
export type UnenrollUsersPayload = Static<typeof unenrollUsersPayloadSchema>;
export type EnrollGroupsPayload = Static<typeof enrollGroupsPayloadSchema>;
export type UnenrollGroupsPayload = Static<typeof unenrollGroupsPayloadSchema>;
export type IntegrationTrainingResultsScope = Static<typeof integrationTrainingResultsScopeSchema>;
export type IntegrationTrainingResult = Static<typeof integrationTrainingResultSchema>;
