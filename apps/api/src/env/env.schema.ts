import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const bulkUpsertEnvSchema = Type.Array(
  Type.Object({
    name: Type.String(),
    value: Type.String(),
  }),
);

export const getEnvResponseSchema = Type.Object({
  name: Type.String(),
  value: Type.String(),
});

export const encryptedEnvSchema = Type.Object({
  name: Type.String(),
  ciphertext: Type.String(),
  iv: Type.String(),
  tag: Type.String(),
  encryptedDek: Type.String(),
  dekIv: Type.String(),
  dekTag: Type.String(),
  version: Type.Optional(Type.Number({ default: 1 })),
  alg: Type.Optional(Type.String({ default: "aes-256-gcm" })),
});

export const frontendSSOEnabledResponseSchema = Type.Object({
  google: Type.Optional(Type.String()),
  microsoft: Type.Optional(Type.String()),
  slack: Type.Optional(Type.String()),
});

export const frontendStripeConfiguredResponseSchema = Type.Object({
  enabled: Type.Boolean(),
});

export const stripePublishableKeyResponseSchema = Type.Object({
  publishableKey: Type.Union([Type.String(), Type.Null()]),
});

export const isEnvSetupResponseSchema = Type.Object({
  fullyConfigured: Type.Array(Type.String()),
  partiallyConfigured: Type.Array(
    Type.Object({
      service: Type.String(),
      missingKeys: Type.Array(Type.String()),
    }),
  ),
  notConfigured: Type.Array(
    Type.Object({
      service: Type.String(),
      missingKeys: Type.Array(Type.String()),
    }),
  ),
  hasIssues: Type.Boolean(),
  isWarningDismissed: Type.Boolean(),
});

export type EncryptedEnvBody = Static<typeof encryptedEnvSchema>;
export type BulkUpsertEnvBody = Static<typeof bulkUpsertEnvSchema>;
export type FrontendSSOEnabledResponseBody = Static<typeof frontendSSOEnabledResponseSchema>;
export type FrontendStripeConfiguredResponseSchema = Static<
  typeof frontendStripeConfiguredResponseSchema
>;
