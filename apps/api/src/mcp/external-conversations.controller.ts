import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";

import { ExternalConversationsRepository } from "./external-conversations.repository";
import {
  externalConversationSchema,
  externalConversationResponseSchema,
  type ExternalConversationInput,
  type ExternalConversationResponse,
} from "./external-conversations.schema";
import { ExternalConversationRequest } from "./external-conversations.types";
import { ExternalTranscriptSignatureGuard } from "./external-transcript-signature.guard";

@Public()
@Controller("mcp/external-conversations")
export class ExternalConversationsController {
  constructor(private readonly externalConversationsRepository: ExternalConversationsRepository) {}

  @Post()
  @UseGuards(ExternalTranscriptSignatureGuard)
  @Validate({
    request: [{ type: "body", schema: externalConversationSchema }],
    response: baseResponse(externalConversationResponseSchema),
  })
  async append(
    @Body() body: ExternalConversationInput,
    @Req() request: ExternalConversationRequest,
  ): Promise<BaseResponse<ExternalConversationResponse>> {
    const resource = request.externalConversationResource;
    if (!resource) throw new UnauthorizedException("Invalid external transcript signature");
    return new BaseResponse(
      await this.externalConversationsRepository.append(resource.tenantId, body),
    );
  }
}
