import { Body, Controller, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Value } from "@sinclair/typebox/value";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { PHISHING_WEBHOOK_MAX_BODY_BYTES } from "../constants/phishing.constants";
import {
  phishingEmailRequestSchema,
  phishingEmailResponseSchema,
  PhishingEmailRequest,
} from "../schemas/phishing-email.schema";
import { PhishingClientService } from "../services/phishing-client.service";
import { PhishingEmailService } from "../services/phishing-email.service";
import { hasPhishingBodyWithinLimit } from "../utils/phishing-webhook.utils";

import type { PhishingEmailResponse } from "../schemas/phishing-email.schema";
import type { Request } from "express";

@ApiExcludeController()
@Controller("phishing/webhook")
export class PhishingEmailController {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingEmailService: PhishingEmailService,
  ) {}

  /** Renders a campaign email for the phishing plugin with this tenant's templates and branding. */
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
      !hasPhishingBodyWithinLimit(request, PHISHING_WEBHOOK_MAX_BODY_BYTES.EMAIL) ||
      !Value.Check(phishingEmailRequestSchema, input)
    )
      throw new UnauthorizedException("phishing.unavailable");

    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      await this.phishingClientService.assertSignedByPhishingPlugin(request);

      return new BaseResponse(await this.phishingEmailService.renderCampaignEmail(input));
    });
  }
}
