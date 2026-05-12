export const CERTIFICATE_KIND = {
  COURSE: "course",
  LEARNING_PATH: "learningPath",
} as const;

export type CertificateKind = (typeof CERTIFICATE_KIND)[keyof typeof CERTIFICATE_KIND];
