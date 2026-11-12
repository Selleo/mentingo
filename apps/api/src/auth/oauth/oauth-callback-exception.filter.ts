import { Catch, Injectable, Logger } from "@nestjs/common";

import { CORS_ORIGIN } from "src/auth/consts";
import { getRequestHostUrl } from "src/common/helpers/getRequestBaseUrl";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { getOAuthLoginErrorKey } from "./oauth-login-error.utils";

import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
@Injectable()
export class OAuthCallbackExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthCallbackExceptionFilter.name);

  constructor(private readonly tenantResolverService: TenantResolverService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();

    const errorKey = getOAuthLoginErrorKey(exception, request.query?.error);

    this.logger.warn(
      `OAuth callback ${request.path} failed with ${errorKey}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );

    const redirectUrl = new URL("/auth/login", await this.getRedirectBaseUrl(request));
    redirectUrl.searchParams.set("error", errorKey);

    response.redirect(redirectUrl.toString());
  }

  private async getRedirectBaseUrl(request: Request): Promise<string> {
    const tenantHost = await this.tenantResolverService
      .resolveTenantHost(request)
      .catch(() => null);

    return tenantHost ?? getRequestHostUrl(request) ?? CORS_ORIGIN;
  }
}
