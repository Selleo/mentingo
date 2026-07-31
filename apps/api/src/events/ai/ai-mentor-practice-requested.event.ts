import type { UUIDType } from "src/common";

export class AiMentorPracticeRequestedEvent {
  constructor(
    public readonly data: {
      tenantId: UUIDType;
      sessionId: UUIDType;
    },
  ) {}
}
