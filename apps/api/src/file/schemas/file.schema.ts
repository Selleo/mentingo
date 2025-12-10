import { ApiProperty } from "@nestjs/swagger";

export class FileUploadResponse {
  @ApiProperty()
  fileKey: string;

  @ApiProperty({ required: false })
  fileUrl?: string;

  @ApiProperty({ required: false })
  status?: string;
}
