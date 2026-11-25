import type { SupportedLanguages } from "@repo/shared";

import { summarizeDueDateCourseTitles } from "../translations/dueDateCourses";
import type { OverdueCoursesEmailCourse } from "../templates/OverdueCoursesEmail";
import type { EmailTemplateVariableValue } from "../template-registry.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOverdueCourse = (value: unknown): value is OverdueCoursesEmailCourse =>
  isRecord(value) &&
  typeof value.courseTitle === "string" &&
  typeof value.learnersCount === "number";

export const formatEmailTemplateVariables = (
  variables: Readonly<Record<string, EmailTemplateVariableValue>>,
  language: SupportedLanguages,
): Record<string, EmailTemplateVariableValue> => {
  const result = { ...variables };
  if (Array.isArray(result.courses)) {
    if (!result.courses.every(isOverdueCourse)) {
      throw new Error("emailTemplates.errors.invalidCollection");
    }
    result.courses = summarizeDueDateCourseTitles(result.courses, language);
  }
  return result;
};
