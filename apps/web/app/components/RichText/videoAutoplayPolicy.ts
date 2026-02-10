import { VIDEO_AUTOPLAY, type VideoAutoplay } from "@repo/shared";

export type RichTextVideoAutoplayPolicy = "inherit" | "disabled";

export const resolveRichTextVideoAutoplay = (
  autoplay: VideoAutoplay,
  policy: RichTextVideoAutoplayPolicy,
): VideoAutoplay => {
  if (policy === "disabled") return VIDEO_AUTOPLAY.NO_AUTOPLAY;
  return autoplay;
};
