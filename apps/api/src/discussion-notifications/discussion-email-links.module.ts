import { Module } from "@nestjs/common";

import { DiscussionEmailLinkService } from "src/discussion-notifications/discussion-email-link.service";
import { DiscussionEmailLinksRepository } from "src/discussion-notifications/discussion-email-links.repository";
import { DiscussionUnsubscribeTokenService } from "src/discussion-notifications/discussion-unsubscribe-token.service";

@Module({
  providers: [
    DiscussionEmailLinksRepository,
    DiscussionUnsubscribeTokenService,
    DiscussionEmailLinkService,
  ],
  exports: [
    DiscussionEmailLinksRepository,
    DiscussionUnsubscribeTokenService,
    DiscussionEmailLinkService,
  ],
})
export class DiscussionEmailLinksModule {}
