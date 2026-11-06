import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { courseSettingsFormSchema } from "~/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema";

import { addCourseFormSchema } from "./addCourseFormSchema";

import type i18next from "i18next";

const t = ((key: string) => key) as typeof i18next.t;
const values = {
  title: "é".repeat(255),
  description: "Description",
  categoryId: "category",
  language: SUPPORTED_LANGUAGES.EN,
};

describe("course title limits", () => {
  it.each([addCourseFormSchema(t), courseSettingsFormSchema(t)])(
    "accepts 255 characters and rejects 256",
    (schema) => {
      expect(schema.safeParse(values).success).toBe(true);
      expect(schema.safeParse({ ...values, title: "é".repeat(256) }).success).toBe(false);
    },
  );
});
