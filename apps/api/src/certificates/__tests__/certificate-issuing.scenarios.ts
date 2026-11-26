import { CERTIFICATE_VALIDITY_TYPES, CERTIFICATE_VALIDITY_UNITS } from "@repo/shared";

export const COURSE_COMPLETED_AT = "2026-06-15T10:00:00.000Z";

export const CERTIFICATE_EXPIRY_CASES = [
  { validityLabel: "no validity", certificateValidity: null, expectedExpiresAt: null },
  {
    validityLabel: "a 10 day validity",
    certificateValidity: {
      type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
      value: 10,
      unit: CERTIFICATE_VALIDITY_UNITS.DAYS,
    },
    expectedExpiresAt: "2026-06-25T10:00:00.000Z",
  },
  {
    validityLabel: "a 2 month validity",
    certificateValidity: {
      type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
      value: 2,
      unit: CERTIFICATE_VALIDITY_UNITS.MONTHS,
    },
    expectedExpiresAt: "2026-08-15T10:00:00.000Z",
  },
  {
    validityLabel: "a 1 year validity",
    certificateValidity: {
      type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
      value: 1,
      unit: CERTIFICATE_VALIDITY_UNITS.YEARS,
    },
    expectedExpiresAt: "2027-06-15T10:00:00.000Z",
  },
  {
    validityLabel: "a fixed expiry date",
    certificateValidity: { type: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE, date: "2030-05-01" },
    expectedExpiresAt: "2030-05-01T23:59:59.999Z",
  },
];

export const ISSUING_REJECTIONS = {
  CERTIFICATE_DISABLED: "the course offers no certificate",
  COURSE_NOT_COMPLETED: "the learner has not completed the course",
} as const;

export type IssuingRejection = (typeof ISSUING_REJECTIONS)[keyof typeof ISSUING_REJECTIONS];

export const ISSUING_REJECTION_CASES = [
  {
    rejection: ISSUING_REJECTIONS.CERTIFICATE_DISABLED,
    expectedMessage: "studentCertificateView.informations.courseCertificateDisabled",
  },
  {
    rejection: ISSUING_REJECTIONS.COURSE_NOT_COMPLETED,
    expectedMessage: "studentCertificateView.informations.courseCompletionRequired",
  },
];
