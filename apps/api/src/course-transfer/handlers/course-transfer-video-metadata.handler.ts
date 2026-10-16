import { Injectable, type OnModuleInit } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { VideoMetadataQueueService } from "src/file/video-metadata.queue.service";
import { getBunnyVideoId } from "src/file/video-metadata.utils";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";

import { CourseTransferVideoMetadataRequestedEvent } from "../events/course-transfer-video-metadata-requested.event";
import { courseTransferVideoMetadataRequestedEventSchema } from "../schemas/course-transfer.schema";

@Injectable()
export class CourseTransferVideoMetadataHandler implements OnModuleInit {
  constructor(
    private readonly videoMetadataQueueService: VideoMetadataQueueService,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
  ) {}

  onModuleInit(): void {
    this.outboxDirectHandlerService.register(
      CourseTransferVideoMetadataRequestedEvent.name,
      (payload) => this.enqueueVideoMetadataDiscovery(payload),
    );
  }

  /** Starts Bunny duration discovery for a resource once its transferred course has committed. */
  private async enqueueVideoMetadataDiscovery(payload: Record<string, unknown>): Promise<void> {
    const bunnyVideoId =
      Value.Check(courseTransferVideoMetadataRequestedEventSchema, payload) &&
      getBunnyVideoId(payload.fileKey);
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
