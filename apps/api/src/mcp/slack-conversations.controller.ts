import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";

import { McpAuthGuard } from "./mcp-auth.guard";
import { MCP_SCOPES } from "./mcp-tool-scope";
import { McpRequest } from "./mcp.types";
import { SlackConversationsRepository } from "./slack-conversations.repository";
import {
  slackConversationSchema,
  slackConversationResponseSchema,
  type SlackConversationInput,
  type SlackConversationResponse,
} from "./slack-conversations.schema";


/** Explicit transcript ingestion. MCP tool calls never create conversation records. */
@Public()
@Controller("mcp/slack-conversations")
export class SlackConversationsController {
  constructor(private readonly slackConversationsRepository: SlackConversationsRepository) {}

  @Post()
  @UseGuards(McpAuthGuard)
  @Validate({
    request: [{ type: "body", schema: slackConversationSchema }],
    response: baseResponse(slackConversationResponseSchema),
  })
  async append(
    @Body() body: SlackConversationInput,
    @Req() request: McpRequest,
  ): Promise<BaseResponse<SlackConversationResponse>> {
    const actor = request.mcpActor;
    if (
      !actor ||
      actor.grant.scopes.length !== 1 ||
      actor.grant.scopes[0] !== MCP_SCOPES.STUDENT_READ
    ) {
      throw new ForbiddenException("Slack transcript ingestion requires student:read");
    }
    return new BaseResponse(await this.slackConversationsRepository.append(actor, body));
  }
}
