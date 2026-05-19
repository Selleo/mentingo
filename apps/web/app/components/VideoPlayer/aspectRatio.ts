export type VideoAspectRatio = {
  width: number;
  height: number;
};

export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = {
  width: 16,
  height: 9,
};

export const getVideoAspectRatio = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
};

export const formatVideoAspectRatio = ({ width, height }: VideoAspectRatio) =>
  `${width} / ${height}`;

export const isVerticalVideoAspectRatio = ({ width, height }: VideoAspectRatio) => height > width;
