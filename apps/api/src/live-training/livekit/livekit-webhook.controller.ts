import { Controller, Headers, Logger, Post, Req } from "@nestjs/common";

import { BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";

import { LiveTrainingSessionsService } from "../live-training-sessions/live-training-sessions.service";

type RequestWithRawBody = Request & {
  rawBody?: string | Buffer;
  body?: unknown;
};

@Public()
@Controller("live-training/livekit")
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(private readonly liveTrainingSessionsService: LiveTrainingSessionsService) {}

  @Post("webhook")
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RequestWithRawBody,
  ) {
    const body = this.getRawBody(request);
    const authorizationHeader = this.getAuthorizationHeader(headers);

    this.logger.debug(
      `LiveKit webhook received: ${JSON.stringify({
        hasAuthorizationHeader: Boolean(authorizationHeader),
        authorizationHeaderName: this.getAuthorizationHeaderName(headers),
        bodyLength: body?.length ?? 0,
        contentType: headers["content-type"],
        userAgent: headers["user-agent"],
      })}`,
    );

    await this.liveTrainingSessionsService.handleLiveKitWebhook({
      body: body ?? "",
      authorizationHeader,
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

  private getRawBody(request: RequestWithRawBody) {
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
}
