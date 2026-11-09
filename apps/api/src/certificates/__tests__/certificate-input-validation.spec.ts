import { Value } from "@sinclair/typebox/value";

import { createCourseSchema } from "src/courses/schemas/createCourse.schema";
import { updateCourseSchema } from "src/courses/schemas/updateCourse.schema";
import { updateUserProfileSchema, updateUserSchema } from "src/user/schemas/updateUser.schema";

import type { TSchema } from "@sinclair/typebox";

describe("certificate source input limits", () => {
  it.each([updateUserSchema, updateUserProfileSchema])(
    "limits both update name fields",
    (schema: TSchema) => {
      for (const name of ["firstName", "lastName"]) {
        expect(Value.Check(schema, { [name]: "é".repeat(64) })).toBe(true);
        expect(Value.Check(schema, { [name]: "é".repeat(65) })).toBe(false);
        expect(Value.Check(schema, { [name]: "O'Neill-Łukasz" })).toBe(true);
        expect(Value.Check(schema, { [name]: "<b><img src=x>" })).toBe(true);
      }
    },
  );

  it.each([createCourseSchema, updateCourseSchema])(
    "limits course titles on creation and update",
    (schema: TSchema) => {
      const input = {
        description: "Course",
        language: "en",
        categoryId: "d898818f-65e2-4c59-8ddd-1d41959e585b",
      };
      expect(Value.Check(schema, { ...input, title: "é".repeat(255) })).toBe(true);
      expect(Value.Check(schema, { ...input, title: "é".repeat(256) })).toBe(false);
    },
  );
});
