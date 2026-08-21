import type { UUIDType } from "src/common";

export type ResourceVideoDurationUpdatedData = {
  resourceId: UUIDType;
};

export class ResourceVideoDurationUpdatedEvent {
  constructor(public readonly resourceVideoDurationUpdatedData: ResourceVideoDurationUpdatedData) {}
}
