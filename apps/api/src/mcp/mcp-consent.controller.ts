import { Controller, Get, Header, Param, Req } from "@nestjs/common";
import { Request } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";

import { mcpConsentDetailsSchema, mcpConsentIdSchema } from "./mcp-oauth-consent.schema";
import { McpOAuthService } from "./mcp-oauth.service";

import type { McpConsentDetails } from "./mcp-oauth-consent.schema";

@Public()
@Controller("oauth/consent")
export class McpConsentController {
  constructor(private readonly oauth: McpOAuthService) {}

  @Get(":consent")
  @Header("Cache-Control", "no-store")
  @Validate({
    request: [{ type: "param", name: "consent", schema: mcpConsentIdSchema }],
    response: baseResponse(mcpConsentDetailsSchema),
  })
  async getConsent(
    @Param("consent") consent: string,
    @Req() request: Request,
  ): Promise<BaseResponse<McpConsentDetails>> {
    return new BaseResponse(await this.oauth.consentDetails(request, consent));
  }
}
