import type { UUIDType } from "src/common";

type UserWelcome = {
  email: string;
  userId: UUIDType;
  tenantId: UUIDType;
  origin?: string;
};

export class UserWelcomeEvent {
  constructor(public readonly userWelcome: UserWelcome) {}
}
