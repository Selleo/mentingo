import { TENANT_USER_CAPACITY_ALERT_LEVELS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const tenantUserCapacityAlertRaisedDataSchema = Type.Object({
  tenantId: UUIDSchema,
  alertLevel: Type.Enum(TENANT_USER_CAPACITY_ALERT_LEVELS),
  activeUsersCount: Type.Integer({ minimum: 0 }),
  maxUsers: Type.Integer({ minimum: 1 }),
  allowedUsersCount: Type.Integer({ minimum: 1 }),
});

export const tenantUserCapacityAlertRaisedEventSchema = Type.Object({
  tenantUserCapacityAlertRaisedData: tenantUserCapacityAlertRaisedDataSchema,
});
