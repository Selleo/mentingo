import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const templates = require("../dist/index.cjs");

const defaults = { primaryColor: "#4796FD", companyName: "Mentingo", language: "en" };

const cases = [
  [
    "AnnouncementEmail",
    {
      title: "System maintenance",
      content: "We will be doing maintenance tomorrow.",
      buttonLink: "https://example.com/notice",
      ...defaults,
    },
  ],
  [
    "BaseEmailTemplate",
    {
      heading: "Hello",
      paragraphs: ["Line one.", "Line two."],
      buttonText: "Open",
      buttonLink: "https://example.com",
      primaryColor: defaults.primaryColor,
      companyName: defaults.companyName,
    },
  ],
  [
    "CertificateExpirationWarningEmail",
    {
      courseName: "TypeScript Fundamentals",
      courseLink: "https://example.com/course",
      expiresAt: "2026-08-01",
      ...defaults,
    },
  ],
  [
    "CertificateExpiredEmail",
    {
      courseName: "TypeScript Fundamentals",
      courseLink: "https://example.com/course",
      reason: "expired",
      ...defaults,
    },
  ],
  [
    "CourseDueDateReminderEmail",
    {
      courseName: "TypeScript Fundamentals",
      courseLink: "https://example.com/course",
      dueDate: "2026-08-01",
      daysBeforeDueDate: 7,
      ...defaults,
    },
  ],
  [
    "CreatePasswordReminderEmail",
    { createPasswordLink: "https://example.com/create-password", ...defaults },
  ],
  [
    "FinishedCourseEmail",
    {
      userName: "Jane Doe",
      courseName: "TypeScript Fundamentals",
      progressLink: "https://example.com/course",
      ...defaults,
    },
  ],
  [
    "LiveTrainingEndedEmail",
    {
      title: "Kickoff meeting",
      content: "Thanks for attending.",
      liveTrainingLink: "https://example.com/lt",
      ...defaults,
    },
  ],
  [
    "LiveTrainingReminderEmail",
    {
      title: "Kickoff meeting",
      content: "Starts in 30 minutes.",
      liveTrainingLink: "https://example.com/lt",
      ...defaults,
    },
  ],
  [
    "LiveTrainingStartedEmail",
    {
      title: "Kickoff meeting",
      content: "The session has started.",
      liveTrainingLink: "https://example.com/lt",
      ...defaults,
    },
  ],
  ["MagicLinkEmail", { magicLink: "https://example.com/magic?token=abc", ...defaults }],
  [
    "NewUserEmail",
    { userName: "Jane Doe", profileLink: "https://example.com/profile", ...defaults },
  ],
  [
    "OverdueCoursesEmail",
    {
      courses: [
        {
          courseTitle: "TypeScript Fundamentals",
          groups: [
            {
              groupName: "Team Alpha",
              dueDate: "2026-07-01",
              students: [
                { name: "Jane Doe", email: "jane@example.com" },
                { name: "John Roe", email: "john@example.com" },
              ],
            },
          ],
        },
      ],
      coursesLink: "https://example.com/courses",
      ...defaults,
    },
  ],
  [
    "PasswordRecoveryEmail",
    { name: "Jane", resetLink: "https://example.com/reset?token=abc", ...defaults },
  ],
  ["UserAssignedToCourseEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFinishedChapterEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFinishedCourseEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFirstLoginEmail", { name: "Jane", coursesUrl: "https://example.com/courses", ...defaults }],
  [
    "UserInviteEmail",
    {
      invitedByUserName: "Admin User",
      createPasswordLink: "https://example.com/create-password",
      ...defaults,
    },
  ],
  [
    "UserLongInactivityEmail",
    {
      courseName: "TypeScript Fundamentals",
      courseLink: "https://example.com/course",
      ...defaults,
    },
  ],
  [
    "UserShortInactivityEmail",
    {
      courseName: "TypeScript Fundamentals",
      courseLink: "https://example.com/course",
      ...defaults,
    },
  ],
  ["WelcomeEmail", { coursesLink: "https://example.com/courses", ...defaults }],
];

describe("@repo/email-templates", () => {
  for (const [name, props] of cases) {
    it(`renders ${name} to html and text`, async () => {
      const Template = templates[name];

      assert.equal(typeof Template, "function");

      const instance = new Template(props);
      const [html, text] = await Promise.all([instance.html, instance.text]);

      assert.match(html, /^<!DOCTYPE html PUBLIC/);
      assert.match(html, /<html/i);
      assert.match(html, /Mentingo|TypeScript|Hello|Jane|Kickoff|System maintenance/);
      assert.ok(text.length > 0);
      assert.doesNotMatch(text, /<[^>]+>/);
    });
  }
});
