export type S3StreamUploadOptions = {
  partSize?: number;
  onUploadedBytes?: (uploadedBytes: number) => void;
};
