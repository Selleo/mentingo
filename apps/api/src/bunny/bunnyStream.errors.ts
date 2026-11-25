import { VideoMp4UnavailableReason } from "./bunnyStream.types";

export class VideoMp4UnavailableError extends Error {
  constructor(
    readonly videoId: string,
    readonly reason: VideoMp4UnavailableReason,
  ) {
    super(`No MP4 fallback was available for Bunny video ${videoId} (${reason}).`);
    this.name = VideoMp4UnavailableError.name;
  }
}

export class VideoUploadError extends Error {
  constructor(
    readonly videoId: string,
    readonly isTransient: boolean,
    failureDetail: string,
  ) {
    super(`Bunny stream upload failed for video ${videoId}: ${failureDetail}`);
    this.name = VideoUploadError.name;
  }
}
