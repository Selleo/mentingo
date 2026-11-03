export const SIGNING_SECRET = "a".repeat(32);

export const SIGNED_AT_SECONDS = 1700000000;

export const SIGNED_BODY = '{"action":"clicked"}';

export const SIGNATURE_TAMPERING = {
  NONE: "none",
  DIFFERENT_BODY: "differentBody",
  WRONG_SECRET: "wrongSecret",
  MALFORMED_SIGNATURE: "malformedSignature",
  MALFORMED_TIMESTAMP: "malformedTimestamp",
  SHORT_SECRET: "shortSecret",
} as const;

export type SignatureTampering = (typeof SIGNATURE_TAMPERING)[keyof typeof SIGNATURE_TAMPERING];

export const SIGNATURE_CASES = [
  {
    title: "the exact signed bytes",
    tampering: SIGNATURE_TAMPERING.NONE,
    verifiedAfterSeconds: 0,
    expected: true,
  },
  {
    title: "a signature that is almost five minutes old",
    tampering: SIGNATURE_TAMPERING.NONE,
    verifiedAfterSeconds: 299,
    expected: true,
  },
  {
    title: "a signature from slightly in the future",
    tampering: SIGNATURE_TAMPERING.NONE,
    verifiedAfterSeconds: -60,
    expected: true,
  },
  {
    title: "a signature older than five minutes",
    tampering: SIGNATURE_TAMPERING.NONE,
    verifiedAfterSeconds: 400,
    expected: false,
  },
  {
    title: "a different body",
    tampering: SIGNATURE_TAMPERING.DIFFERENT_BODY,
    verifiedAfterSeconds: 0,
    expected: false,
  },
  {
    title: "a signature made with another secret",
    tampering: SIGNATURE_TAMPERING.WRONG_SECRET,
    verifiedAfterSeconds: 0,
    expected: false,
  },
  {
    title: "a signature that is not hex SHA-256",
    tampering: SIGNATURE_TAMPERING.MALFORMED_SIGNATURE,
    verifiedAfterSeconds: 0,
    expected: false,
  },
  {
    title: "a timestamp that is not in Unix seconds",
    tampering: SIGNATURE_TAMPERING.MALFORMED_TIMESTAMP,
    verifiedAfterSeconds: 0,
    expected: false,
  },
  {
    title: "a secret shorter than 32 characters",
    tampering: SIGNATURE_TAMPERING.SHORT_SECRET,
    verifiedAfterSeconds: 0,
    expected: false,
  },
] as const;
