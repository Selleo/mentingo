import { Type } from "@sinclair/typebox";

export const FILE_PREVIEW_FORMAT = {
  PDF: "pdf",
} as const;

export const filePreviewQuerySchema = Type.Optional(Type.Literal(FILE_PREVIEW_FORMAT.PDF));

export type FilePreviewFormat = (typeof FILE_PREVIEW_FORMAT)[keyof typeof FILE_PREVIEW_FORMAT];
export type FilePreviewQuery = FilePreviewFormat | undefined;
export type FilePreviewOptions = {
  contentType?: string;
  preview?: FilePreviewFormat;
};
export type FilePreviewDeliveryOptions = FilePreviewOptions & {
  range?: string;
};
