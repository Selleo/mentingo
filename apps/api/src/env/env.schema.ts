import { LOGIN_METHODS } from "@repo/shared";
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

export const loginMethodSchema = Type.Union(
  Object.values(LOGIN_METHODS).map((method) => Type.Literal(method)),
);

export const loginMethodsResponseSchema = Type.Object({
  [LOGIN_METHODS.GOOGLE]: Type.Boolean(),
  [LOGIN_METHODS.MICROSOFT]: Type.Boolean(),
  [LOGIN_METHODS.SLACK]: Type.Boolean(),
  [LOGIN_METHODS.MAGIC_LINK]: Type.Boolean(),
  [LOGIN_METHODS.PASSWORD]: Type.Boolean(),
});

export const loginMethodSetupResponseSchema = Type.Object({
  methods: loginMethodsResponseSchema,
  missingCredentials: Type.Object({
    [LOGIN_METHODS.GOOGLE]: Type.Array(Type.String()),
    [LOGIN_METHODS.MICROSOFT]: Type.Array(Type.String()),
    [LOGIN_METHODS.SLACK]: Type.Array(Type.String()),
  }),
});

export const updateLoginMethodSchema = Type.Object(
  {
    method: loginMethodSchema,
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type LoginMethodsResponse = Static<typeof loginMethodsResponseSchema>;
export type LoginMethodSetupResponse = Static<typeof loginMethodSetupResponseSchema>;
export type UpdateLoginMethodBody = Static<typeof updateLoginMethodSchema>;

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

export const isConfiguredResponseSchema = Type.Object({
  enabled: Type.Boolean(),
});

export const voiceTtsProviderSchema = Type.Union([
  Type.Literal("cartesia"),
  Type.Literal("elevenlabs"),
  Type.Literal("openaiCompatible"),
]);

export type VoiceTtsProvider = Static<typeof voiceTtsProviderSchema>;

export const lumaConfiguredResponseSchema = Type.Object({
  enabled: Type.Boolean(),
  courseGenerationEnabled: Type.Boolean(),
  voiceMentorEnabled: Type.Boolean(),
  voiceTtsProvider: voiceTtsProviderSchema,
});

export const aiCapabilityMatrixItemSchema = Type.Object({
  key: Type.Union([
    Type.Literal("phishing"),
    Type.Literal("aiMentor"),
    Type.Literal("voiceMentor"),
    Type.Literal("courseGeneration"),
    Type.Literal("assetGeneration"),
  ]),
  status: Type.Union([Type.Literal("enabled"), Type.Literal("disabled")]),
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
  aiCapabilities: Type.Array(aiCapabilityMatrixItemSchema),
  hasIssues: Type.Boolean(),
  isWarningDismissed: Type.Boolean(),
});

export type EncryptedEnvBody = Static<typeof encryptedEnvSchema>;
export type BulkUpsertEnvBody = Static<typeof bulkUpsertEnvSchema>;
export type FrontendSSOEnabledResponseBody = Static<typeof frontendSSOEnabledResponseSchema>;
export type FrontendStripeConfiguredResponseSchema = Static<
  typeof frontendStripeConfiguredResponseSchema
>;
