import type { SupportedLanguages } from "@repo/shared";

import { getOverdueCoursesEmailTranslations } from "../translations/overdueCourses";
import type { OverdueCoursesEmailCourse } from "../templates/OverdueCoursesEmail";
import type { EmailTemplateVariableValue } from "../template-registry.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOverdueCourse = (value: unknown): value is OverdueCoursesEmailCourse =>
  isRecord(value) &&
  typeof value.courseTitle === "string" &&
  Array.isArray(value.groups) &&
  value.groups.every(
    (group) =>
      isRecord(group) &&
      typeof group.groupName === "string" &&
      typeof group.dueDate === "string" &&
      Array.isArray(group.students) &&
      group.students.every(
        (student) =>
          isRecord(student) &&
          typeof student.name === "string" &&
          typeof student.email === "string",
      ),
  );

export const formatEmailTemplateVariables = (
  variables: Readonly<Record<string, EmailTemplateVariableValue>>,
  language: SupportedLanguages,
): Record<string, EmailTemplateVariableValue> => {
  const result = { ...variables };
  if (Array.isArray(result.courses)) {
    if (!result.courses.every(isOverdueCourse)) {
      throw new Error("emailTemplates.errors.invalidCollection");
    }
    result.courses = getOverdueCoursesEmailTranslations(language, result.courses).paragraphs.join(
      "\n",
    );
  }
  return result;
};
