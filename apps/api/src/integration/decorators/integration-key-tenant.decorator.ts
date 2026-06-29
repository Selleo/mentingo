import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from "@nestjs/common";

import type {
  IntegrationKeyTenantContext,
  IntegrationRequest,
} from "src/integration/integration.types";

export const IntegrationKeyTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IntegrationKeyTenantContext => {
    const request = ctx.switchToHttp().getRequest<IntegrationRequest>();

    if (!request.integrationKeyTenantId || request.integrationKeyTenantIsManaging === undefined) {
      throw new InternalServerErrorException("integrationApiKey.errors.missingKeyTenantContext");
    }

    return {
      tenantId: request.integrationKeyTenantId,
      isManaging: request.integrationKeyTenantIsManaging,
    };
  },
);
