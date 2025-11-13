import { InactiveUsers } from "src/events/user/user-short-inactivity.event";

export class UsersLongInactivityEvent {
  constructor(public readonly usersLongInactivity: InactiveUsers) {}
}
