import { Type } from "@sinclair/typebox";

import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  adminSettingsJSONContentSchema,
  studentSettingsJSONContentSchema,
} from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const updateSettingsBodySchema = Type.Partial(
  Type.Union([studentSettingsJSONContentSchema, adminSettingsJSONContentSchema]),
);

export const updateMFAEnforcedRolesSchema = Type.Record(
  Type.Enum(USER_ROLES),
  Type.Optional(Type.Boolean()),
);

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
export type UpdateMFAEnforcedRolesRequest = Static<typeof updateMFAEnforcedRolesSchema>;
