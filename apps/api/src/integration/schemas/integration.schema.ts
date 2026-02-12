import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { enrolledCourseGroupsPayload } from "src/courses/schemas/course.schema";
import { createCoursesEnrollmentSchema } from "src/courses/schemas/createCoursesEnrollment";

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

export const unenrollUsersPayloadSchema = createCoursesEnrollmentSchema;
export const enrollUsersPayloadSchema = createCoursesEnrollmentSchema;

export const enrollGroupsPayloadSchema = enrolledCourseGroupsPayload;
export const unenrollGroupsPayloadSchema = Type.Object({
  groupIds: Type.Array(UUIDSchema),
});

export type IntegrationCreateUserBody = Static<typeof createUserSchema>;
export type IntegrationUpdateUserBody = Static<typeof updateUserSchema>;
export type SetUserGroupsBody = Static<typeof setUserGroupsSchema>;
export type EnrollUsersPayload = Static<typeof enrollUsersPayloadSchema>;
export type UnenrollUsersPayload = Static<typeof unenrollUsersPayloadSchema>;
export type EnrollGroupsPayload = Static<typeof enrollGroupsPayloadSchema>;
export type UnenrollGroupsPayload = Static<typeof unenrollGroupsPayloadSchema>;
