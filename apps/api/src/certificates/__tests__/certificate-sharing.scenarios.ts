import { SUPPORTED_LANGUAGES } from "@repo/shared";

export const PUBLIC_SHARE_PATHS = {
  PAGE: "/api/certificates/share",
  IMAGE: "/api/certificates/share-image",
} as const;

export const SHARE_TOKEN_KINDS = {
  CERTIFICATE_ID: "the certificate ID",
  MALFORMED: "a malformed token",
} as const;

export type ShareTokenKind = (typeof SHARE_TOKEN_KINDS)[keyof typeof SHARE_TOKEN_KINDS];

export const INVALID_SHARE_TOKEN_CASES = [
  {
    path: PUBLIC_SHARE_PATHS.PAGE,
    tokenKind: SHARE_TOKEN_KINDS.CERTIFICATE_ID,
    expectedStatus: 404,
  },
  { path: PUBLIC_SHARE_PATHS.PAGE, tokenKind: SHARE_TOKEN_KINDS.MALFORMED, expectedStatus: 400 },
  {
    path: PUBLIC_SHARE_PATHS.IMAGE,
    tokenKind: SHARE_TOKEN_KINDS.CERTIFICATE_ID,
    expectedStatus: 404,
  },
  { path: PUBLIC_SHARE_PATHS.IMAGE, tokenKind: SHARE_TOKEN_KINDS.MALFORMED, expectedStatus: 400 },
];

export const SHARE_PAGE_LANGUAGE_CASES = [
  {
    language: SUPPORTED_LANGUAGES.EN,
    expectedTitle: "<title>Course completion certificate for &quot;Shared Course&quot;</title>",
  },
  {
    language: SUPPORTED_LANGUAGES.PL,
    expectedTitle: "<title>Certyfikat ukończenia kursu &quot;Shared Course&quot;</title>",
  },
];
