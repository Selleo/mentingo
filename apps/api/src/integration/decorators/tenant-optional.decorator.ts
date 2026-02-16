import { SetMetadata } from "@nestjs/common";

export const INTEGRATION_TENANT_OPTIONAL = "integrationTenantOptional";

export const IntegrationTenantOptional = () => SetMetadata(INTEGRATION_TENANT_OPTIONAL, true);
