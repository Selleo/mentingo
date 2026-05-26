import type { UUIDType } from "src/common";

export class LiveTrainingSessionEvent {
  constructor(
    public readonly payload: {
      liveTrainingId: UUIDType;
      sessionId: UUIDType;
      tenantId: UUIDType;
      eventName: string;
      userId?: UUIDType;
    },
  ) {}
}
