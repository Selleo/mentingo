import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiForbiddenResponse, ApiHeader, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { ApiEndpointDocs } from "src/common/decorators/api-endpoint-docs.decorator";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { IntegrationKeyTenant } from "./decorators/integration-key-tenant.decorator";
import { IntegrationTenantOptional } from "./decorators/tenant-optional.decorator";
import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { IntegrationKeyTenantContext } from "./integration.types";
import {
  integrationContentMarketplaceConnectionSchema,
  integrationPluginConfiguredSchema,
  integrationPluginStatusSchema,
  type IntegrationContentMarketplaceConnection,
  type IntegrationPluginConfigured,
  type IntegrationPluginStatus,
} from "./schemas/integration-plugin-connection.schema";
import { IntegrationContentMarketplaceConnectionService } from "./services/integration-content-marketplace-connection.service";

@ApiHeader({
  name: "X-API-Key",
  required: true,
  description: "Integration API key used to authenticate every integration request.",
})
@ApiTags("Integration")
@ApiUnauthorizedResponse({
  description: "Missing or invalid integration API key.",
})
@ApiForbiddenResponse({
  description: "Authenticated integration key owner is not authorized.",
})
@Public()
@Controller("integration")
@UseGuards(IntegrationApiKeyGuard, PermissionsGuard)
export class IntegrationContentMarketplaceController {
  constructor(
    private readonly integrationContentMarketplaceConnectionService: IntegrationContentMarketplaceConnectionService,
  ) {}

  @ApiEndpointDocs({
    summary: "Connect a tenant to the content marketplace",
    description:
      "Atomically saves the content marketplace plugin origin and API key, encrypted for the path tenant. Retrying with the same values is safe. Requires a managing tenant key with tenant management permission.",
  })
  @Put("tenants/:tenantId/plugins/content-marketplace")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @IntegrationTenantOptional()
  @Validate({
    request: [
      { type: "param", name: "tenantId", schema: UUIDSchema },
      { type: "body", schema: integrationContentMarketplaceConnectionSchema },
    ],
    response: baseResponse(integrationPluginConfiguredSchema),
  })
  async saveContentMarketplaceConnection(
    @Param("tenantId") tenantId: UUIDType,
    @Body() body: IntegrationContentMarketplaceConnection,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
  ): Promise<BaseResponse<IntegrationPluginConfigured>> {
    return new BaseResponse(
      await this.integrationContentMarketplaceConnectionService.saveContentMarketplaceConnection(
        tenantId,
        body,
        actor,
        keyTenant,
      ),
    );
  }

  @ApiEndpointDocs({
    summary: "Verify tenant content marketplace connectivity",
    description:
      "Checks that Mentingo can authenticate to the configured content marketplace plugin and reports whether the marketplace is enabled for the tenant. Requires a managing tenant key with tenant management permission. No credentials are returned.",
  })
  @Get("tenants/:tenantId/plugins/content-marketplace")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @IntegrationTenantOptional()
  @Validate({
    request: [{ type: "param", name: "tenantId", schema: UUIDSchema }],
    response: baseResponse(integrationPluginStatusSchema),
  })
  async checkContentMarketplaceConnection(
    @Param("tenantId") tenantId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
  ): Promise<BaseResponse<IntegrationPluginStatus>> {
    return new BaseResponse(
      await this.integrationContentMarketplaceConnectionService.checkContentMarketplaceConnection(
        tenantId,
        actor,
        keyTenant,
      ),
    );
  }
}
