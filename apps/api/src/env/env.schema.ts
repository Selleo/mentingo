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

export const frontendPosthogConfigResponseSchema = Type.Object({
  key: Type.Optional(Type.String()),
  host: Type.Optional(Type.String()),
});

export const stripePublishableKeyResponseSchema = Type.Object({
  publishableKey: Type.Union([Type.String(), Type.Null()]),
});

export type EncryptedEnvBody = Static<typeof encryptedEnvSchema>;
export type BulkUpsertEnvBody = Static<typeof bulkUpsertEnvSchema>;
export type FrontendSSOEnabledResponseBody = Static<typeof frontendSSOEnabledResponseSchema>;
