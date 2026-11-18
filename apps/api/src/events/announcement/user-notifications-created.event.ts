import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  userNotificationsCreatedEventSchema,
  type userNotificationsCreatedDataSchema,
} from "./user-notifications-created.schema";

import type { Static } from "@sinclair/typebox";

export type UserNotificationsCreatedData = Static<typeof userNotificationsCreatedDataSchema>;

@OutboxEvent({ payloadSchema: userNotificationsCreatedEventSchema })
export class UserNotificationsCreatedEvent {
  constructor(public readonly userNotificationsCreatedData: UserNotificationsCreatedData) {}
}
