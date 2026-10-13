import type { UUIDType } from "src/common";

export type CertificateEmailRecipient = {
  tenantId: UUIDType;
  userId: UUIDType;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  courseName: string;
  courseLink: string;
};
