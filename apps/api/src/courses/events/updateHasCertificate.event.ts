import type { UUIDType } from "src/common";

export type UpdateHasCertificateData = {
  courseId: UUIDType;
  tenantId: UUIDType;
};

export class UpdateHasCertificateEvent {
  constructor(public readonly courseData: UpdateHasCertificateData) {}
}
