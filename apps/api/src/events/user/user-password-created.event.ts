import { CommonUser } from "src/common/schemas/common-user.schema";

export class UserPasswordCreatedEvent {
  constructor(public readonly user: CommonUser) {}
}
