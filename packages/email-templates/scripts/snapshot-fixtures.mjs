#!/usr/bin/env node
// Renders every email template with fixed sample props and writes HTML fixtures.
// Used as a regression baseline around the react-email major-version bump.
//
// Usage:
//   pnpm --filter @repo/email-templates build   (rebuild dist first)
//   node packages/email-templates/scripts/snapshot-fixtures.mjs
//
// Diff test/fixtures/ before vs after the bump. Anything more than cosmetic
// (whitespace / attribute ordering) means the templates need adjustment.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../dist/index.cjs");

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "test", "fixtures");
mkdirSync(outDir, { recursive: true });

const defaults = { primaryColor: "#4796FD", companyName: "Mentingo", language: "en" };

const cases = [
  ["AnnouncementEmail", { title: "System maintenance", content: "We will be doing maintenance tomorrow.", buttonLink: "https://example.com/notice", ...defaults }],
  ["BaseEmailTemplate", { heading: "Hello", paragraphs: ["Line one.", "Line two."], buttonText: "Open", buttonLink: "https://example.com", primaryColor: defaults.primaryColor, companyName: defaults.companyName }],
  ["CertificateExpirationWarningEmail", { courseName: "TypeScript Fundamentals", courseLink: "https://example.com/course", expiresAt: "2026-08-01", ...defaults }],
  ["CertificateExpiredEmail", { courseName: "TypeScript Fundamentals", courseLink: "https://example.com/course", reason: "expired", ...defaults }],
  ["CourseDueDateReminderEmail", { courseName: "TypeScript Fundamentals", courseLink: "https://example.com/course", dueDate: "2026-08-01", daysBeforeDueDate: 7, ...defaults }],
  ["CreatePasswordReminderEmail", { createPasswordLink: "https://example.com/create-password", ...defaults }],
  ["FinishedCourseEmail", { userName: "Jane Doe", courseName: "TypeScript Fundamentals", progressLink: "https://example.com/course", ...defaults }],
  ["LiveTrainingEndedEmail", { title: "Kickoff meeting", content: "Thanks for attending.", liveTrainingLink: "https://example.com/lt", ...defaults }],
  ["LiveTrainingReminderEmail", { title: "Kickoff meeting", content: "Starts in 30 minutes.", liveTrainingLink: "https://example.com/lt", ...defaults }],
  ["LiveTrainingStartedEmail", { title: "Kickoff meeting", content: "The session has started.", liveTrainingLink: "https://example.com/lt", ...defaults }],
  ["MagicLinkEmail", { magicLink: "https://example.com/magic?token=abc", ...defaults }],
  ["NewUserEmail", { userName: "Jane Doe", profileLink: "https://example.com/profile", ...defaults }],
  ["OverdueCoursesEmail", {
    courses: [
      {
        courseTitle: "TypeScript Fundamentals",
        groups: [
          { groupName: "Team Alpha", dueDate: "2026-07-01", students: [{ name: "Jane Doe", email: "jane@example.com" }, { name: "John Roe", email: "john@example.com" }] },
        ],
      },
    ],
    coursesLink: "https://example.com/courses",
    ...defaults,
  }],
  ["PasswordRecoveryEmail", { name: "Jane", resetLink: "https://example.com/reset?token=abc", ...defaults }],
  ["UserAssignedToCourseEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFinishedChapterEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFinishedCourseEmail", { courseName: "TypeScript Fundamentals", ...defaults }],
  ["UserFirstLoginEmail", { name: "Jane", coursesUrl: "https://example.com/courses", ...defaults }],
  ["UserInviteEmail", { invitedByUserName: "Admin User", createPasswordLink: "https://example.com/create-password", ...defaults }],
  ["UserLongInactivityEmail", { courseName: "TypeScript Fundamentals", courseLink: "https://example.com/course", ...defaults }],
  ["UserShortInactivityEmail", { courseName: "TypeScript Fundamentals", courseLink: "https://example.com/course", ...defaults }],
  ["WelcomeEmail", { coursesLink: "https://example.com/courses", ...defaults }],
];

const rendered = [];
for (const [name, props] of cases) {
  const Ctor = pkg[name];
  if (!Ctor) {
    console.error(`missing export: ${name}`);
    process.exitCode = 1;
    continue;
  }
  const instance = new Ctor(props);
  const htmlRaw = instance.html;
  const html = typeof htmlRaw?.then === "function" ? await htmlRaw : htmlRaw;
  writeFileSync(join(outDir, `${name}.html`), html);
  rendered.push(name);
}

console.log(`wrote ${rendered.length} fixtures to ${outDir}`);
