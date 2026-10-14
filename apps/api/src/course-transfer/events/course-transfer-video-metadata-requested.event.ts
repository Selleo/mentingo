import { UUIDType } from "src/common";

/** Discover recipient video metadata after its resource and course graph commit. */
export class CourseTransferVideoMetadataRequestedEvent {
  constructor(
    public readonly tenantId: UUIDType,
    public readonly resourceId: UUIDType,
    public readonly fileKey: string,
  ) {}
}
