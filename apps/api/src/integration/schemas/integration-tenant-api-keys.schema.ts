import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { ALLOWED_SECRETS } from "src/env/env.config";

export const integrationTenantEnvNameSchema = Type.Union(
  ALLOWED_SECRETS.map((name) => Type.Literal(name)),
);

export const integrationUpdateTenantApiKeysSchema = Type.Object(
  {
    name: integrationTenantEnvNameSchema,
    value: Type.String({
      maxLength: 4096,
      writeOnly: true,
      description: "Tenant environment value. Stored encrypted; never returned in responses.",
    }),
  },
  { additionalProperties: false },
);

export const integrationUpdateTenantApiKeysResponseSchema = Type.Object({
  tenantId: UUIDSchema,
  updatedKeys: Type.Array(integrationTenantEnvNameSchema),
});

export type IntegrationUpdateTenantApiKeysBody = Static<
  typeof integrationUpdateTenantApiKeysSchema
>;
export type IntegrationUpdateTenantApiKeysResponse = Static<
  typeof integrationUpdateTenantApiKeysResponseSchema
>;
