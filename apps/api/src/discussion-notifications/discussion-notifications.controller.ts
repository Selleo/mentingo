import { Body, Controller, Post } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { DiscussionUnsubscribeService } from "src/discussion-notifications/discussion-unsubscribe.service";
import {
  discussionUnsubscribeBodySchema,
  discussionUnsubscribeResponseSchema,
  type DiscussionUnsubscribeBody,
  type DiscussionUnsubscribeResponse,
} from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

@Controller("discussion-notifications")
export class DiscussionNotificationsController {
  constructor(private readonly discussionUnsubscribeService: DiscussionUnsubscribeService) {}

  @Post("unsubscribe")
  @Public()
  @Validate({
    request: [{ type: "body", schema: discussionUnsubscribeBodySchema }],
    response: baseResponse(discussionUnsubscribeResponseSchema),
  })
  async unsubscribe(
    @Body() body: DiscussionUnsubscribeBody,
  ): Promise<BaseResponse<DiscussionUnsubscribeResponse>> {
    return new BaseResponse(await this.discussionUnsubscribeService.unsubscribe(body.token));
  }
}
