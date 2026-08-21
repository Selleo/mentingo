export type ResourceMetadata = {
  allowFullscreen?: boolean;
  originalFilename?: string;
  size?: number | string;
  durationSeconds?: number;
  [key: string]: unknown;
};
