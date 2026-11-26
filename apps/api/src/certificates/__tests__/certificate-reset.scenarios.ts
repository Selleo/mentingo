import { CERTIFICATE_RESET_SCOPES } from "@repo/shared";

export const RESET_SCOPE_VALIDATION_CASES = [
  {
    scope: CERTIFICATE_RESET_SCOPES.GROUPS,
    expectedMessage: "adminCourseView.settings.validation.groupIdsRequired",
  },
  {
    scope: CERTIFICATE_RESET_SCOPES.USERS,
    expectedMessage: "adminCourseView.settings.validation.userIdsRequired",
  },
];

export const RESET_USER_PAGE_CASES = [
  { page: 1, expectedLearners: ["Alpha", "Beta"] },
  { page: 2, expectedLearners: ["Gamma"] },
];

export const RESET_USER_SEARCH_CASES = [
  { search: "gamma-reset", searchedBy: "email", expectedLearners: ["Gamma"] },
  { search: "Reset Alpha", searchedBy: "last and first name", expectedLearners: ["Alpha"] },
  { search: "missing-user", searchedBy: "an unknown phrase", expectedLearners: [] },
];

export const RESET_MANAGEMENT_ENDPOINTS = {
  RESET_OPTIONS: "GET reset-options",
  RESET_USERS: "GET reset-users",
  RESET: "POST reset",
} as const;

export type ResetManagementEndpoint =
  (typeof RESET_MANAGEMENT_ENDPOINTS)[keyof typeof RESET_MANAGEMENT_ENDPOINTS];

export const RESET_MANAGEMENT_REQUESTERS = {
  ANONYMOUS: "an anonymous requester",
  STUDENT: "a student",
  FOREIGN_AUTHOR: "an author of other courses",
} as const;

export type ResetManagementRequester =
  (typeof RESET_MANAGEMENT_REQUESTERS)[keyof typeof RESET_MANAGEMENT_REQUESTERS];

const STUDENT_REJECTION = {
  expectedStatus: 403,
  expectedBody: { message: "auth.error.missingPermission" },
};

const FOREIGN_AUTHOR_REJECTION = {
  expectedStatus: 400,
  expectedBody: { message: "adminCourseView.settings.validation.certificateManageDenied" },
};

export const RESET_MANAGEMENT_REJECTION_CASES = [
  {
    endpoint: RESET_MANAGEMENT_ENDPOINTS.RESET_USERS,
    requester: RESET_MANAGEMENT_REQUESTERS.ANONYMOUS,
    expectedStatus: 401,
    expectedBody: {},
  },
  {
    endpoint: RESET_MANAGEMENT_ENDPOINTS.RESET_USERS,
    requester: RESET_MANAGEMENT_REQUESTERS.STUDENT,
    ...STUDENT_REJECTION,
  },
  {
    endpoint: RESET_MANAGEMENT_ENDPOINTS.RESET_USERS,
    requester: RESET_MANAGEMENT_REQUESTERS.FOREIGN_AUTHOR,
    ...FOREIGN_AUTHOR_REJECTION,
  },
  {
    endpoint: RESET_MANAGEMENT_ENDPOINTS.RESET_OPTIONS,
    requester: RESET_MANAGEMENT_REQUESTERS.FOREIGN_AUTHOR,
    ...FOREIGN_AUTHOR_REJECTION,
  },
  {
    endpoint: RESET_MANAGEMENT_ENDPOINTS.RESET,
    requester: RESET_MANAGEMENT_REQUESTERS.STUDENT,
    ...STUDENT_REJECTION,
  },
];
