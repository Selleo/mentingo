import {
  CertificateExpiredEmail,
  CourseDueDateReminderEmail,
  UserFinishedCourseEmail,
  UserAssignedToCourseEmail,
  UserShortInactivityEmail,
  UserLongInactivityEmail,
  getEmailSubject,
  getEmailTemplateDefinition,
  renderEmailTemplate,
  type EmailTemplateEvent,
  type EmailTemplateVariableValue,
} from "@repo/email-templates";
import {
  CERTIFICATE_ARCHIVE_REASONS,
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
  const definition = getEmailTemplateDefinition(event);
  const variables = {
    ...validation.getSampleVariables(event),
    course_name: courseName,
    ...overrides,
  };
  validation.validatePublished(
    event,
    definition.name,
    definition.subjects,
    definition.defaultDocuments,
    "en",
  );
  validation.validateRuntimeVariables(event, definition.defaultDocuments[language], variables);
  return renderEmailTemplate({
    event: event,
    document: definition.defaultDocuments[language],
    subject: definition.subjects[language],
    variables,
    language,
    branding,
  });
}

describe.each(Object.values(SUPPORTED_LANGUAGES))("Dynamic email wording in %s", (language) => {
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
        expect(normalize(actual.text)).toContain(normalize(expected.text));
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
});

describe("Previously saved default wording", () => {
  it.each<{
    event: EmailTemplateEvent;
    text: string;
    overrides: Record<string, EmailTemplateVariableValue>;
    expected: string;
  }>([
    {
      event: "course_due_date_reminder" as const,
      text: 'The deadline to complete course "{{ course_name }}" is in 3 days.',
      overrides: { days_before_due_date: 0 },
      expected: 'The deadline to complete course "Safety <training>" is today.',
    },
    {
      event: "user_finished_course" as const,
      text: "You've completed {{ course_name }}. Your certificate is ready to download; check the recommended next steps.",
      overrides: { has_certificate: false },
      expected: "You've completed Safety <training>.",
    },
    {
      event: "certificate_expired" as const,
      text: "Your certificate for {{ course_name }} has been reset by an administrator.",
      overrides: { reason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED },
      expected: "Your certificate for Safety <training> has expired.",
    },
  ])(
    "resolves untouched $event wording and preserves administrator edits",
    ({ event, text, overrides, expected }) => {
      const definition = getEmailTemplateDefinition(event);
      const document = structuredClone(definition.defaultDocuments.en);
      document.content = [
        { type: "text", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        {
          type: "text",
          content: [{ type: "paragraph", content: [{ type: "text", text: `Custom: ${text}` }] }],
        },
      ];
      if (event === "user_finished_course")
        document.content.push({
          type: "button",
          attrs: { label: "DOWNLOAD CERTIFICATE", url: "{{ button_link }}" },
        });
      if (event === "certificate_expired")
        document.content.push({
          type: "heading",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Certificate reset" }] }],
        });
      const before = structuredClone(document);
      const result = renderEmailTemplate({
        event: event,
        document,
        subject: "Update",
        variables: {
          ...validation.getSampleVariables(event),
          course_name: courseName,
          ...overrides,
        },
        language: "en",
        branding,
      });
      expect(normalize(result.text)).toContain(expected);
      expect(normalize(result.text)).toContain(
        `Custom: ${text.replace("{{ course_name }}", courseName)}`,
      );
      if (event === "user_finished_course") expect(result.text).toContain("CONTINUE LEARNING");
      if (event === "certificate_expired") expect(result.text).toContain("Certificate expired");
      expect(document).toEqual(before);
    },
  );
});

describe("Legacy assignment and inactivity templates", () => {
  it.each<{
    event: EmailTemplateEvent;
    text: string;
    label: string;
    subject: string;
    expected: string;
    expectedSubject: string;
    expectedLabel: string;
  }>([
    {
      event: "user_assigned_to_course",
      text: "This course is mandatory and must be completed by {{ formatted_course_due_date }}.",
      label: "MY COURSES",
      subject: "Assignment",
      expected: "",
      expectedSubject: "Assignment",
      expectedLabel: "MY COURSES",
    },
    {
      event: "user_short_inactivity",
      text: "14 days since last activity in {{ course_name }}. Continue to keep your progress on track.",
      label: "CONTINUE COURSE",
      subject: "Continue your course - {{ course_name }}",
      expected: "14 days since last activity on platform.",
      expectedSubject: "Continue your journey on the platform",
      expectedLabel: "OPEN PLATFORM",
    },
    {
      event: "user_long_inactivity",
      text: "It's been 30 days since your last activity in {{ course_name }}. Resuming now will help you finish on time.",
      label: "RESUME COURSE",
      subject: "Come back to your courses",
      expected: "It's been 30 days since your last activity on platform.",
      expectedSubject: "Come back to your courses",
      expectedLabel: "RESUME COURSE",
    },
  ])(
    "resolves the no-date/no-course $event variant without changing saved content",
    ({ event, text, label, subject, expected, expectedSubject, expectedLabel }) => {
      const definition = getEmailTemplateDefinition(event);
      const document = structuredClone(definition.defaultDocuments.en);
      document.content = [
        { type: "text", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        { type: "button", attrs: { label, url: "{{ course_link }}" } },
      ];
      const before = structuredClone(document);
      const variables: Record<string, EmailTemplateVariableValue> = {
        ...validation.getSampleVariables(event),
        course_name: "",
        course_link: link,
      };
      delete variables.formatted_course_due_date;
      const actual = renderEmailTemplate({
        event,
        document,
        subject,
        variables,
        language: "en",
        branding,
      });
      expect(actual.subject).toBe(expectedSubject);
      expect(normalize(actual.text)).toContain(expected);
      expect(actual.text).toContain(expectedLabel);
      expect(actual.text).not.toContain("completed by");
      expect(actual.text).not.toContain("activity in .");
      expect(document).toEqual(before);

      const customSubject = "Custom reminder {{ course_name }}";
      const custom = renderEmailTemplate({
        event,
        document,
        subject: customSubject,
        variables,
        language: "en",
        branding,
      });
      expect(custom.subject).toBe("Custom reminder ");
    },
  );
});
