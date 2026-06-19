import type { UUIDType } from "src/common";

export type InactiveUser = {
  userId: UUIDType;
  name: string;
  email: string;
};
export type InactiveUsers = {
  tenantId: UUIDType;
  users: InactiveUser[];
};

export class UsersShortInactivityEvent {
  constructor(public readonly usersShortInactivity: InactiveUsers) {}
}
