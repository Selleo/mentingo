import type { UUIDType } from "src/common";

export type CertificateEmailRecipient = {
  tenantId: UUIDType;
  userId: UUIDType;
  userEmail: string;
  courseName: string;
  courseLink: string;
};
