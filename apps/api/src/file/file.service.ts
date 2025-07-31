import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";

import { S3Service } from "src/s3/s3.service";

import { MAX_FILE_SIZE, EXTENSION_TO_MIME_TYPE_MAP } from "./file.constants";
import { MimeTypeGuard } from "./guards/mime-type.guard";

@Injectable()
export class FileService {
  constructor(private readonly s3Service: S3Service) {}

  async getFileUrl(fileKey: string): Promise<string> {
    if (!fileKey) return "https://app.lms.localhost/app/assets/placeholders/card-placeholder.jpg";
    if (fileKey.startsWith("https://")) return fileKey;

    return await this.s3Service.getSignedUrl(fileKey);
  }

  async uploadFile(file: Express.Multer.File, resource: string) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException("File upload failed - invalid file data");
    }

    if (file.size && file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE} bytes`,
      );
    }

    let mimetype: string | undefined = file.mimetype;
    if (!mimetype) {
      const extension = file.originalname.split(".").pop()?.toLowerCase();
      mimetype = extension ? EXTENSION_TO_MIME_TYPE_MAP[extension] : undefined;
    }

    MimeTypeGuard.validateMimeType(mimetype);

    try {
      const fileExtension = file.originalname.split(".").pop();
      const fileKey = `${resource}/${crypto.randomUUID()}.${fileExtension}`;

      await this.s3Service.uploadFile(file.buffer, fileKey, mimetype);

      const fileUrl = await this.s3Service.getSignedUrl(fileKey);

      return { fileKey, fileUrl };
    } catch (error) {
      throw new ConflictException("Failed to upload file");
    }
  }

  async deleteFile(fileKey: string) {
    try {
      return await this.s3Service.deleteFile(fileKey);
    } catch (error) {
      throw new ConflictException("Failed to delete file");
    }
  }
}
