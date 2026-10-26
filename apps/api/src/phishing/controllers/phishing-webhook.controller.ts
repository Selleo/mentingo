import { isPhishingRiskyActionEvent } from "@mentingo/phishing-simulation-sdk";
import { Body, Controller, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { PHISHING_WEBHOOK_MAX_BODY_BYTES } from "../constants/phishing.constants";
import {
  phishingConnectionProbeResponseSchema,
  phishingConnectionProbeSchema,
  PhishingConnectionProbe,
} from "../schemas/phishing-webhook.schema";
import { PhishingClientService } from "../services/phishing-client.service";
import { PhishingEnrollmentService } from "../services/phishing-enrollment.service";
import { hasPhishingBodyWithinLimit } from "../utils/phishing-webhook.utils";

import type {
  PhishingConnectionProbeResponse,
  PhishingRiskyActionAcknowledgement,
} from "../schemas/phishing-webhook.schema";
import type { Request } from "express";

@Controller("phishing")
export class PhishingWebhookController {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly phishingClientService: PhishingClientService,
    private readonly phishingEnrollmentService: PhishingEnrollmentService,
  ) {}

  /** Lets the phishing plugin confirm it shares this tenant's webhook secret. */
  @Public()
  @Post("webhook/probe")
  @Validate({
    request: [{ type: "body", schema: phishingConnectionProbeSchema }],
    response: baseResponse(phishingConnectionProbeResponseSchema),
  })
  async connectionProbe(
    @Body() probe: PhishingConnectionProbe,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<BaseResponse<PhishingConnectionProbeResponse>> {
    if (
      !hasPhishingBodyWithinLimit(request, PHISHING_WEBHOOK_MAX_BODY_BYTES.CONNECTION_PROBE) ||
      !Value.Check(phishingConnectionProbeSchema, request.body)
    )
      throw new UnauthorizedException("phishing.unavailable");

    return this.tenantDbRunnerService.runWithTenant(probe.tenantId, async () => {
      await this.phishingClientService.assertSignedByPhishingPlugin(request);

      return new BaseResponse({ nonce: probe.nonce });
    });
  }

  /** Enrolls a campaign recipient in the campaign's course after a confirmed risky action. */
  @Public()
  @Post("webhook")
  async webhook(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<BaseResponse<PhishingRiskyActionAcknowledgement>> {
    const event: unknown = request.body;

    if (
      !hasPhishingBodyWithinLimit(request, PHISHING_WEBHOOK_MAX_BODY_BYTES.RISKY_ACTION) ||
      !isPhishingRiskyActionEvent(event)
    )
      throw new UnauthorizedException("phishing.unavailable");

    return this.tenantDbRunnerService.runWithTenant(event.tenantId, async () => {
      await this.phishingClientService.assertSignedByPhishingPlugin(request);
      await this.phishingEnrollmentService.enrollRecipientAfterRiskyAction(event);

      return new BaseResponse({ accepted: true as const });
    });
  }
}
