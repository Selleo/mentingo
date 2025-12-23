export function uploadKey(uploadId: string) {
  return `video-upload:${uploadId}`;
}

export function videoKey(videoId: string) {
  return `video-upload:video:${videoId}`;
}
