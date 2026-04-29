import { ALLOWED_AGE_LIMITS, HEX_COLOR_REGEX } from "@repo/shared";
import { Type } from "@sinclair/typebox";

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
  Type.String({ minLength: 1 }),
  Type.Optional(Type.Boolean()),
);

export const updateDefaultCourseCurrencySchema = Type.Object({
  defaultCourseCurrency: Type.Union(ALLOWED_CURRENCIES.map((currency) => Type.Literal(currency))),
});

export const updateGamificationPointDefaultsSchema = Type.Object({
  defaultChapterPoints: Type.Integer({ minimum: 0 }),
  defaultCoursePoints: Type.Integer({ minimum: 0 }),
  defaultAiPassPoints: Type.Integer({ minimum: 0 }),
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
export type UpdateGamificationPointDefaultsBody = Static<
  typeof updateGamificationPointDefaultsSchema
>;
export type UpdateGlobalColorSchemaBody = Static<typeof updateGlobalColorSchema>;
export type UpdateConfigWarningDismissedBody = Static<typeof updateConfigWarningDismissedSchema>;
export type UpdateAgeLimitBody = Static<typeof updateAgeLimitSchema>;
