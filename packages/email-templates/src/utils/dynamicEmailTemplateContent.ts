import { CERTIFICATE_ARCHIVE_REASONS, type SupportedLanguages } from "@repo/shared";

import { getCertificateExpiredEmailTranslations } from "../translations/certificateExpired";
import { getCourseDueDateReminderEmailTranslations } from "../translations/courseDueDateReminder";
import { getUserFinishedCourseEmailTranslations } from "../translations/userFinishedCourse";
import {
  EMAIL_TEMPLATE_EVENTS,
  type EmailTemplateEvent,
  type EmailTemplateVariableValue,
} from "../template-registry.types";
import { getEmailSubject } from "../email-subjects";
import { getUserAssignedToCourseEmailTranslations } from "../translations/userAssignedToCourse";
import { getUserShortInactivityEmailTranslations } from "../translations/userShortInactivity";
import { getUserLongInactivityEmailTranslations } from "../translations/userLongInactivity";

export function getDynamicEmailTemplateContent(
  event: EmailTemplateEvent,
  variables: Readonly<Record<string, EmailTemplateVariableValue>>,
  language: SupportedLanguages,
) {
  const derivedVariables: Record<string, string> = {};
  const legacyReplacements = new Map<string, string>();

  const courseName = String(variables.course_name ?? "");

  const addVariable = (key: string, value: string, legacy: string) => {
    derivedVariables[key] = value;
    legacyReplacements.set(legacy, `{{ ${key} }}`);
  };

  if (
    event === EMAIL_TEMPLATE_EVENTS.COURSE_DUE_DATE_REMINDER &&
    typeof variables.days_before_due_date === "number"
  ) {
    const content = getCourseDueDateReminderEmailTranslations(
      language,
      courseName,
      String(variables.due_date ?? ""),
      variables.days_before_due_date,
    );
    const legacy = getCourseDueDateReminderEmailTranslations(
      language,
      "{{ course_name }}",
      "{{ due_date }}",
      3,
    );
    addVariable("deadline_message", content.paragraphs[0]!, legacy.paragraphs[0]!);
  }

  if (
    event === EMAIL_TEMPLATE_EVENTS.USER_FINISHED_COURSE &&
    typeof variables.has_certificate === "boolean"
  ) {
    const content = getUserFinishedCourseEmailTranslations(
      language,
      courseName,
      variables.has_certificate,
    );
    const legacy = getUserFinishedCourseEmailTranslations(language, "{{ course_name }}", true);
    addVariable("course_completion_message", content.paragraphs[1]!, legacy.paragraphs[1]!);
    addVariable("course_completion_action", content.buttonText, legacy.buttonText);
  }

  if (
    event === EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRED &&
    (variables.reason === CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET ||
      variables.reason === CERTIFICATE_ARCHIVE_REASONS.EXPIRED)
  ) {
    const content = getCertificateExpiredEmailTranslations(language, courseName, variables.reason);
    const legacy = getCertificateExpiredEmailTranslations(
      language,
      "{{ course_name }}",
      CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
    );
    addVariable("certificate_archive_heading", content.heading, legacy.heading);
    addVariable("certificate_archive_message", content.paragraphs[0]!, legacy.paragraphs[0]!);
  }

  if (event === EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE) {
    const content = getUserAssignedToCourseEmailTranslations(
      language,
      courseName,
      String(variables.formatted_course_due_date ?? ""),
    );
    const legacy = getUserAssignedToCourseEmailTranslations(
      language,
      "{{ course_name }}",
      "{{ formatted_course_due_date }}",
    );
    addVariable("assignment_deadline_message", content.paragraphs[2] ?? "", legacy.paragraphs[2]!);
  }

  if (
    event === EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY ||
    event === EMAIL_TEMPLATE_EVENTS.USER_LONG_INACTIVITY
  ) {
    const isShortInactivity = event === EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY;
    const getContent = isShortInactivity
      ? getUserShortInactivityEmailTranslations
      : getUserLongInactivityEmailTranslations;

    const content = getContent(language, courseName);
    const legacy = getContent(language, "{{ course_name }}");
    addVariable("inactivity_message", content.paragraphs[1]!, legacy.paragraphs[1]!);
    addVariable("inactivity_action", content.buttonText, legacy.buttonText);

    const subjectKey = isShortInactivity ? "userShortInactivityEmail" : "userLongInactivityEmail";
    const resolvedSubjectKey =
      isShortInactivity && !courseName ? "userShortInactivityPlatformEmail" : subjectKey;

    addVariable(
      "inactivity_subject",
      getEmailSubject(resolvedSubjectKey, language, { courseName }),
      getEmailSubject(subjectKey, language, { courseName: "{{ course_name }}" }),
    );
  }

  return { derivedVariables, legacyReplacements };
}
