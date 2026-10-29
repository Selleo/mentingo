import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
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
import { ExternalTranscriptSignatureGuard } from "./external-transcript-signature.guard";
import { McpAuthGuard } from "./mcp-auth.guard";
import { MCP_SCOPES } from "./mcp-tool-scope";
import { McpRequest } from "./mcp.types";

/** Explicit transcript ingestion. MCP tool calls never create conversation records. */
@Public()
@Controller("mcp/external-conversations")
export class ExternalConversationsController {
  constructor(private readonly externalConversationsRepository: ExternalConversationsRepository) {}

  @Post()
  @UseGuards(McpAuthGuard, ExternalTranscriptSignatureGuard)
  @Validate({
    request: [{ type: "body", schema: externalConversationSchema }],
    response: baseResponse(externalConversationResponseSchema),
  })
  async append(
    @Body() body: ExternalConversationInput,
    @Req() request: McpRequest,
  ): Promise<BaseResponse<ExternalConversationResponse>> {
    const actor = request.mcpActor;
    if (
      !actor ||
      actor.grant.scopes.length !== 1 ||
      actor.grant.scopes[0] !== MCP_SCOPES.STUDENT_READ
    ) {
      throw new ForbiddenException("External transcript ingestion requires student:read");
    }
    return new BaseResponse(await this.externalConversationsRepository.append(actor, body));
  }
}
