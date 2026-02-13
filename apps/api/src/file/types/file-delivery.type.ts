import type { FileStreamPayload } from "./file-stream.type";

export const FILE_DELIVERY_TYPE = {
  STREAM: "stream",
  REDIRECT: "redirect",
} as const;

export type FileDeliveryType = (typeof FILE_DELIVERY_TYPE)[keyof typeof FILE_DELIVERY_TYPE];

export type FileDeliveryResult =
  | ({ type: typeof FILE_DELIVERY_TYPE.STREAM } & FileStreamPayload)
  | { type: typeof FILE_DELIVERY_TYPE.REDIRECT; url: string };
