import { Type } from "@sinclair/typebox";

import { USER_ROLES } from "src/user/schemas/userRoles";

import { ALLOWED_CURRENCIES } from "../constants/settings.constants";

import {
  adminSettingsJSONContentSchema,
  studentSettingsJSONContentSchema,
} from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

export const updateSettingsBodySchema = Type.Partial(
  Type.Union([studentSettingsJSONContentSchema, adminSettingsJSONContentSchema]),
);

export const updateMFAEnforcedRolesSchema = Type.Record(
  Type.Enum(USER_ROLES),
  Type.Optional(Type.Boolean()),
);

export const updateDefaultCourseCurrencySchema = Type.Object({
  defaultCourseCurrency: Type.Union(ALLOWED_CURRENCIES.map((currency) => Type.Literal(currency))),
});

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
export type UpdateMFAEnforcedRolesRequest = Static<typeof updateMFAEnforcedRolesSchema>;
export type UpdateDefaultCourseCurrencyBody = Static<typeof updateDefaultCourseCurrencySchema>;
