import type { UUIDType } from "src/common";

type UserSessionRevokedData = {
  userId: UUIDType;
  sessionId: string;
};

export class UserSessionRevokedEvent {
  constructor(public readonly sessionData: UserSessionRevokedData) {}
}
