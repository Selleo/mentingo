import { UUIDType } from "src/common";

export class UpdateHasCertificateEvent {
  constructor(public readonly courseId: UUIDType) {}
}
