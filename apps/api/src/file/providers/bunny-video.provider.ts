import { Injectable } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";

import type {
  VideoProviderInitPayload,
  VideoProviderInitResult,
  VideoStorageProvider,
} from "../video-storage-provider";

@Injectable()
export class BunnyVideoProvider implements VideoStorageProvider {
  readonly type = VIDEO_PROVIDERS.BUNNY;

  constructor(private readonly bunnyStreamService: BunnyStreamService) {}

  async isAvailable(): Promise<boolean> {
    return this.bunnyStreamService.isConfigured();
  }

  async initVideoUpload(payload: VideoProviderInitPayload): Promise<VideoProviderInitResult> {
    const { filename, title } = payload;
    const response = await this.bunnyStreamService.createVideo(title || filename);
    const fileKey = `bunny-${response.guid}`;
    const { tusEndpoint, tusHeaders, expiresAt } = await this.bunnyStreamService.getTusUploadConfig(
      response.guid,
    );

    return {
      provider: this.type,
      fileKey,
      bunnyGuid: response.guid,
      tusEndpoint,
      tusHeaders,
      expiresAt,
    };
  }
}
