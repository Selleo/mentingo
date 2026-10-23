import { Body, Controller, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Value } from "@sinclair/typebox/value";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { PhishingClientService } from "./phishing-client.service";
import {
  phishingEmailRequestSchema,
  phishingEmailResponseSchema,
  PhishingEmailRequest,
} from "./phishing-email.schema";
import { PhishingEmailService } from "./phishing-email.service";
import { verifyPhishingSignature } from "./phishing-webhook.utils";

import type { PhishingEmailResponse } from "./phishing-email.schema";
import type { Request } from "express";

@ApiExcludeController()
@Controller("phishing/webhook")
export class PhishingEmailController {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingEmailService: PhishingEmailService,
  ) {}

  @Public()
  @Post("email")
  @Validate({
    request: [{ type: "body", schema: phishingEmailRequestSchema }],
    response: baseResponse(phishingEmailResponseSchema),
  })
  async renderCampaignEmail(
    @Body() input: PhishingEmailRequest,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<BaseResponse<PhishingEmailResponse>> {
    if (
      !request.rawBody ||
      request.rawBody.length > 4096 ||
      !Value.Check(phishingEmailRequestSchema, input)
    )
      throw new UnauthorizedException("phishing.unavailable");

    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const secret = await this.phishingClientService.secret("PHISHING_WEBHOOK_SECRET");
      if (
        !secret ||
        !verifyPhishingSignature(
          request.rawBody!,
          secret,
          String(request.headers["x-phishing-timestamp"] ?? ""),
          String(request.headers["x-phishing-signature"] ?? ""),
        )
      )
        throw new UnauthorizedException("phishing.unavailable");

      return new BaseResponse(await this.phishingEmailService.renderCampaignEmail(input));
    });
  }
}
