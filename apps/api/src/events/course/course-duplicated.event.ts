import { UUIDType } from "src/common";

/** A duplicate course finished copying its source course's content. */
export class CourseDuplicatedEvent {
  constructor(
    public readonly tenantId: UUIDType,
    public readonly sourceCourseId: UUIDType,
    public readonly courseId: UUIDType,
    public readonly actorId: UUIDType,
    public readonly duplicatedAt: string,
  ) {}
}
