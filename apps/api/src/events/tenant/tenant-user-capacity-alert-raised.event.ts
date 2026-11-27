import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  tenantUserCapacityAlertRaisedEventSchema,
  type tenantUserCapacityAlertRaisedDataSchema,
} from "./tenant-user-capacity-alert-raised.schema";

import type { Static } from "@sinclair/typebox";

export type TenantUserCapacityAlertRaisedData = Static<
  typeof tenantUserCapacityAlertRaisedDataSchema
>;

@OutboxEvent({ payloadSchema: tenantUserCapacityAlertRaisedEventSchema })
export class TenantUserCapacityAlertRaisedEvent {
  constructor(
    public readonly tenantUserCapacityAlertRaisedData: TenantUserCapacityAlertRaisedData,
  ) {}
}
