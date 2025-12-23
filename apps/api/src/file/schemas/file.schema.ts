import { ApiProperty } from "@nestjs/swagger";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export class FileUploadResponse {
  @ApiProperty()
  fileKey: string;

  @ApiProperty({ required: false })
  fileUrl?: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  uploadId?: string;
}

export const associateLessonWithUploadSchema = Type.Object({
  lessonId: UUIDSchema,
  uploadId: UUIDSchema,
});

export type AssociateLessonWithUploadBody = Static<typeof associateLessonWithUploadSchema>;
