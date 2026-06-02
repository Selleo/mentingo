import type { UUIDType } from "src/common";

export type LiveTrainingSessionEventPayload = {
  liveTrainingId: UUIDType;
  sessionId: UUIDType;
  tenantId: UUIDType;
  eventName: string;
  userId?: UUIDType;
};

export class LiveTrainingSessionEvent {
  constructor(public readonly payload: LiveTrainingSessionEventPayload) {}
}
