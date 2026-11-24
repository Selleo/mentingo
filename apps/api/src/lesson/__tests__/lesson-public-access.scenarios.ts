import { COURSE_STATUSES, LESSON_TYPES } from "@repo/shared";

export const PUBLIC_LESSON_TITLE = "Public onboarding lesson";
export const PUBLIC_LESSON_DESCRIPTION = "<p>Open content</p>";

export const UNAVAILABLE_PREVIEW_CASES = [
  {
    reason: "the preview flag is disabled",
    previewEnabled: false,
    course: { status: COURSE_STATUSES.PUBLISHED, isArchived: false, priceInCents: 0 },
  },
  {
    reason: "the course is private",
    previewEnabled: true,
    course: { status: COURSE_STATUSES.PRIVATE, isArchived: false, priceInCents: 0 },
  },
  {
    reason: "the course is a draft",
    previewEnabled: true,
    course: { status: COURSE_STATUSES.DRAFT, isArchived: false, priceInCents: 0 },
  },
  {
    reason: "the course is archived",
    previewEnabled: true,
    course: { status: COURSE_STATUSES.PUBLISHED, isArchived: true, priceInCents: 0 },
  },
  {
    reason: "the course is paid",
    previewEnabled: true,
    course: { status: COURSE_STATUSES.PUBLISHED, isArchived: false, priceInCents: 1000 },
  },
];

export const GUEST_ACCESS_REJECTION_CASES = [
  {
    reason: "visitor course access is disabled",
    visitorAccessEnabled: false,
    isFreemium: true,
    lessonType: LESSON_TYPES.CONTENT,
  },
  {
    reason: "the chapter is not public",
    visitorAccessEnabled: true,
    isFreemium: false,
    lessonType: LESSON_TYPES.CONTENT,
  },
  {
    reason: "the lesson is not a content lesson",
    visitorAccessEnabled: true,
    isFreemium: true,
    lessonType: LESSON_TYPES.QUIZ,
  },
];
