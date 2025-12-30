import { ALLOWED_AGE_LIMITS, HEX_COLOR_REGEX } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { USER_ROLES } from "src/user/schemas/userRoles";

import { ALLOWED_CURRENCIES } from "../constants/settings.constants";

import {
  adminSettingsJSONContentSchema,
  studentSettingsJSONContentSchema,
} from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];
export type AllowedAgeLimit = (typeof ALLOWED_AGE_LIMITS)[number];

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

export const updateGlobalColorSchema = Type.Object({
  primaryColor: Type.String({
    pattern: HEX_COLOR_REGEX.source,
  }),
  contrastColor: Type.String({
    pattern: HEX_COLOR_REGEX.source,
  }),
});

export const updateConfigWarningDismissedSchema = Type.Object({
  dismissed: Type.Boolean(),
});

export const updateAgeLimitSchema = Type.Object({
  ageLimit: Type.Union(ALLOWED_AGE_LIMITS.map((age) => (!age ? Type.Null() : Type.Literal(age)))),
});

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
export type UpdateMFAEnforcedRolesRequest = Static<typeof updateMFAEnforcedRolesSchema>;
export type UpdateDefaultCourseCurrencyBody = Static<typeof updateDefaultCourseCurrencySchema>;
export type UpdateGlobalColorSchemaBody = Static<typeof updateGlobalColorSchema>;
export type UpdateConfigWarningDismissedBody = Static<typeof updateConfigWarningDismissedSchema>;
export type UpdateAgeLimitBody = Static<typeof updateAgeLimitSchema>;
