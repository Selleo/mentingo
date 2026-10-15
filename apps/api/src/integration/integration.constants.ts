export const INTEGRATION_TENANT_API_KEYS = {
  LUMA_API_KEY: "LUMA_API_KEY",
} as const;

export type IntegrationTenantApiKey =
  (typeof INTEGRATION_TENANT_API_KEYS)[keyof typeof INTEGRATION_TENANT_API_KEYS];
