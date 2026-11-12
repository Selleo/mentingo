import type { ValidatedAudioMimeType } from "src/file/file.constants";

export type ValidatedAudioMetadata = {
  contentType: ValidatedAudioMimeType;
  durationSeconds: number;
};
