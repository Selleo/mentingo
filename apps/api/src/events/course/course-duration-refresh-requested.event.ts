import type { UUIDType } from "src/common";

export type CourseDurationRefreshRequestedData = {
  courseId: UUIDType;
};

export class CourseDurationRefreshRequestedEvent {
  constructor(
    public readonly courseDurationRefreshRequestedData: CourseDurationRefreshRequestedData,
  ) {}
}
