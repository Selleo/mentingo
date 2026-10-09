import {
  CertificateExpiredEmail,
  CourseDueDateReminderEmail,
  UserFinishedCourseEmail,
  UserAssignedToCourseEmail,
  UserShortInactivityEmail,
  UserLongInactivityEmail,
  getEmailSubject,
  getBuiltInTemplatePublication,
  renderEmailTemplate,
  type EmailTemplateEvent,
  type EmailTemplateVariableValue,
} from "@repo/email-templates";
import {
  CERTIFICATE_ARCHIVE_REASONS,
  AUTOMATION_EMAIL_BRANCH_PLANS,
  deriveAutomationBranchFieldValues,
  resolveAutomationEventFieldSourceKey,
  type AutomationEmailBranchPlan,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";

import { EmailTemplateValidationService } from "./email-template-validation.service";

const validation = new EmailTemplateValidationService();
const branding = { companyName: "Acme", primaryColor: "#123456" };
const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
const courseName = "Safety <training>";
const link = "https://example.com/course";

function render(
  event: EmailTemplateEvent,
  language: SupportedLanguages,
  overrides: Record<string, EmailTemplateVariableValue>,
) {
  const variables = {
    ...validation.buildEmailPreviewVariables(event),
    course_name: courseName,
    ...overrides,
  };
  const fields: Record<string, EmailTemplateVariableValue> = {
    ...variables,
    ...deriveAutomationBranchFieldValues(event, variables),
  };
  let plan = AUTOMATION_EMAIL_BRANCH_PLANS[event] as AutomationEmailBranchPlan;
  while ("field" in plan) {
    plan =
      fields[resolveAutomationEventFieldSourceKey(event, plan.field)] === true ? plan.yes : plan.no;
  }
  const publication = getBuiltInTemplatePublication(plan.templateKey);
  return renderEmailTemplate({
    document: publication.content[language]!,
    subject: publication.subject[language]!,
    variables: fields,
    language,
    branding,
  });
}

describe.each(Object.values(SUPPORTED_LANGUAGES))(
  "Branch-specific email wording in %s",
  (language) => {
    it.each(["", "30 September 2026"])("preserves assignment wording with date %j", (date) => {
      const expected = new UserAssignedToCourseEmail({
        ...branding,
        language,
        courseName,
        courseLink: link,
        formatedCourseDueDate: date || null,
      });
      const actual = render("user_assigned_to_course", language, {
        course_link: link,
        formatted_course_due_date: date,
      });
      expect(normalize(actual.text)).toContain(normalize(expected.text));
      expect(actual.html).not.toContain("{{");
    });

    it.each(["user_short_inactivity", "user_long_inactivity"] as const)(
      "preserves both %s variants",
      (event) => {
        for (const name of ["", courseName]) {
          const Email =
            event === "user_short_inactivity" ? UserShortInactivityEmail : UserLongInactivityEmail;
          const expected = new Email({ ...branding, language, courseName: name, courseLink: link });
          const actual = render(event, language, { course_name: name, course_link: link });
          const courseSubjectKey =
            event === "user_short_inactivity"
              ? "userShortInactivityEmail"
              : "userLongInactivityEmail";
          const subjectKey =
            event === "user_short_inactivity" && !name
              ? "userShortInactivityPlatformEmail"
              : courseSubjectKey;
          if (event === "user_long_inactivity" && !name) {
            const platform = new UserShortInactivityEmail({
              ...branding,
              language,
              courseName: "",
              courseLink: link,
            });
            const platformLines = platform.text.split("\n").filter((line) => line.trim());
            const expectedLines = expected.text.split("\n").filter((line) => line.trim());
            expect(expectedLines.length).toBeGreaterThanOrEqual(4);
            expectedLines[0] = platformLines[0]!;
            expectedLines[expectedLines.length - 3] = platformLines[platformLines.length - 3]!;
            expect(normalize(actual.text)).toContain(normalize(expectedLines.join("\n")));
          } else {
            expect(normalize(actual.text)).toContain(normalize(expected.text));
          }
          expect(actual.subject).toBe(getEmailSubject(subjectKey, language, { courseName: name }));
          expect(actual.html).not.toContain("{{");
        }
      },
    );

    it.each([0, 1, 3, 7])("preserves the real deadline (%i days)", (daysBeforeDueDate) => {
      const expected = new CourseDueDateReminderEmail({
        ...branding,
        language,
        courseName,
        courseLink: link,
        dueDate: "2026-10-01",
        daysBeforeDueDate,
      });
      const actual = render("course_due_date_reminder", language, {
        course_link: link,
        due_date: "2026-10-01",
        days_before_due_date: daysBeforeDueDate,
      });
      expect(normalize(actual.text)).toContain(normalize(expected.text));
      expect(actual.html).not.toContain("<training>");
    });

    it.each([false, true])("preserves certificate availability (%s)", (hasCertificate) => {
      const expected = new UserFinishedCourseEmail({
        ...branding,
        language,
        courseName,
        buttonLink: link,
        hasCertificate,
      });
      const actual = render("user_finished_course", language, {
        button_link: link,
        has_certificate: hasCertificate,
      });
      expect(normalize(actual.text)).toContain(normalize(expected.text));
    });

    it.each(Object.values(CERTIFICATE_ARCHIVE_REASONS))(
      "preserves certificate archive reason (%s)",
      (reason) => {
        const expected = new CertificateExpiredEmail({
          ...branding,
          language,
          courseName,
          courseLink: link,
          reason,
        });
        const actual = render("certificate_expired", language, { course_link: link, reason });
        expect(normalize(actual.text)).toContain(normalize(expected.text));
      },
    );
  },
);
