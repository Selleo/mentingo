import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { integrationTenantsSchema } from "./integration.schema";

export const integrationPluginDiscoverySchema = Type.Object({
  tenants: integrationTenantsSchema,
  canConfigurePlugins: Type.Boolean(),
});
export const integrationPhishingConnectionSchema = Type.Object(
  {
    baseUrl: Type.String({ minLength: 1, maxLength: 2000 }),
    apiKey: Type.String({ minLength: 32, maxLength: 256, writeOnly: true }),
    webhookSecret: Type.String({ minLength: 32, maxLength: 256, writeOnly: true }),
  },
  { additionalProperties: false },
);
export const integrationPluginConfiguredSchema = Type.Object({ tenantId: UUIDSchema });
export const integrationPluginStatusSchema = Type.Object({
  tenantId: UUIDSchema,
  reachable: Type.Boolean(),
  enabled: Type.Boolean(),
});
export type IntegrationPluginDiscovery = Static<typeof integrationPluginDiscoverySchema>;
export type IntegrationPhishingConnection = Static<typeof integrationPhishingConnectionSchema>;
export type IntegrationPluginConfigured = Static<typeof integrationPluginConfiguredSchema>;
export type IntegrationPluginStatus = Static<typeof integrationPluginStatusSchema>;
