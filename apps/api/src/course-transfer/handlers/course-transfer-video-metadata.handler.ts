import { Injectable } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { VideoMetadataQueueService } from "src/file/video-metadata.queue.service";
import { getBunnyVideoId } from "src/file/video-metadata.utils";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { CourseTransferVideoMetadataRequestedEvent } from "../events/course-transfer-video-metadata-requested.event";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(CourseTransferVideoMetadataRequestedEvent)
export class CourseTransferVideoMetadataHandler
  implements OutboxEventsHandlerOf<CourseTransferVideoMetadataRequestedEvent>
{
  constructor(private readonly videoMetadataQueueService: VideoMetadataQueueService) {}

  /** Starts Bunny duration discovery for a resource once its transferred course has committed. */
  async handleOutboxEvent({
    videoMetadataRequestData: payload,
  }: CourseTransferVideoMetadataRequestedEvent): Promise<void> {
    const bunnyVideoId = getBunnyVideoId(payload.fileKey);
    if (!bunnyVideoId) throw new Error("Invalid course transfer video metadata event");

    await this.videoMetadataQueueService.enqueueWatchdog({
      tenantId: payload.tenantId,
      resourceId: payload.resourceId,
      provider: VIDEO_PROVIDERS.BUNNY,
      fileKey: payload.fileKey,
      bunnyVideoId,
    });
  }
}
