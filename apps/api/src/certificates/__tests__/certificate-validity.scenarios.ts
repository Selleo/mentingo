import { CERTIFICATE_VALIDITY_TYPES, CERTIFICATE_VALIDITY_UNITS } from "@repo/shared";

export const ONE_DAY_VALIDITY = {
  type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
  value: 1,
  unit: CERTIFICATE_VALIDITY_UNITS.DAYS,
} as const;

export const SYSTEM_ACTOR_EMAIL_CASES = [
  {
    companyShortNameLabel: "Acme LMS",
    companyShortName: "Acme LMS",
    expectedActorEmail: "system@acmelms",
  },
  {
    companyShortNameLabel: "missing",
    companyShortName: null,
    expectedActorEmail: "system@mentingo.com",
  },
];

export const VALIDITY_IMPACT_REJECTIONS = {
  ANONYMOUS_REQUESTER: "the requester is anonymous",
  STUDENT_REQUESTER: "the requester is a student",
  FOREIGN_AUTHOR: "the requester authors other courses only",
  MISSING_COURSE: "the course does not exist",
} as const;

export type ValidityImpactRejection =
  (typeof VALIDITY_IMPACT_REJECTIONS)[keyof typeof VALIDITY_IMPACT_REJECTIONS];

export const VALIDITY_IMPACT_REJECTION_CASES = [
  {
    rejection: VALIDITY_IMPACT_REJECTIONS.ANONYMOUS_REQUESTER,
    expectedStatus: 401,
    expectedBody: {},
  },
  {
    rejection: VALIDITY_IMPACT_REJECTIONS.STUDENT_REQUESTER,
    expectedStatus: 403,
    expectedBody: { message: "auth.error.missingPermission" },
  },
  {
    rejection: VALIDITY_IMPACT_REJECTIONS.FOREIGN_AUTHOR,
    expectedStatus: 400,
    expectedBody: { message: "adminCourseView.settings.validation.certificateManageDenied" },
  },
  {
    rejection: VALIDITY_IMPACT_REJECTIONS.MISSING_COURSE,
    expectedStatus: 404,
    expectedBody: { message: "adminCourseView.errors.notFound.course" },
  },
];
