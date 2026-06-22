import { Controller, Headers, Logger, Post, Req } from "@nestjs/common";

import { BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { LiveTrainingSessionsService } from "../live-training-sessions/live-training-sessions.service";

import { LiveKitWebhookRequest } from "./livekit.types";

@Public()
@Controller("live-training/livekit")
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(
    private readonly liveTrainingSessionsService: LiveTrainingSessionsService,
    private readonly tenantResolverService: TenantResolverService,
  ) {}

  @Post("webhook")
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: LiveKitWebhookRequest,
  ) {
    const body = this.getRawBody(request);
    const authorizationHeader = this.getAuthorizationHeader(headers);
    const requestTenantId = await this.tenantResolverService.resolveTenantId(request);

    this.logger.debug(
      `LiveKit webhook received: ${JSON.stringify({
        hasAuthorizationHeader: Boolean(authorizationHeader),
        authorizationHeaderName: this.getAuthorizationHeaderName(headers),
        bodyLength: body?.length ?? 0,
        contentType: headers["content-type"],
        userAgent: headers["user-agent"],
        requestTenantId,
        requestTarget: this.getRequestTargetDiagnostics(request, headers),
      })}`,
    );

    await this.liveTrainingSessionsService.handleLiveKitWebhook({
      body: body ?? "",
      authorizationHeader,
      requestTenantId: requestTenantId ?? undefined,
    });

    return new BaseResponse({ received: true });
  }

  private getAuthorizationHeader(headers: Record<string, string | string[] | undefined>) {
    const header = headers.authorization ?? headers.authorize;

    if (Array.isArray(header)) {
      return header[0];
    }

    return header;
  }

  private getAuthorizationHeaderName(headers: Record<string, string | string[] | undefined>) {
    if (headers.authorization) return "authorization";
    if (headers.authorize) return "authorize";

    return null;
  }

  private getRawBody(request: LiveKitWebhookRequest) {
    if (Buffer.isBuffer(request.body)) {
      return request.body.toString("utf8");
    }

    if (typeof request.body === "string") {
      return request.body;
    }

    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody.toString("utf8");
    }

    if (typeof request.rawBody === "string") {
      return request.rawBody;
    }

    return "";
  }

  private getRequestTargetDiagnostics(
    request: LiveKitWebhookRequest,
    headers: Record<string, string | string[] | undefined>,
  ) {
    return {
      protocol: request.protocol,
      hostname: request.hostname,
      host: headers.host,
      forwardedHost: headers["x-forwarded-host"],
      forwardedProto: headers["x-forwarded-proto"],
      forwardedFor: headers["x-forwarded-for"],
      originalUrl: request.originalUrl,
      baseUrl: request.baseUrl,
      path: request.path,
      url: request.url,
    };
  }
}
