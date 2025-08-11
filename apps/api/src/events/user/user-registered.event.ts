import { CommonUser } from "src/common/schemas/common-user.schema";

export class UserRegisteredEvent {
  constructor(public readonly user: CommonUser) {}
}
