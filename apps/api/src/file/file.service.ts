import { randomUUID } from "crypto";
import { Readable } from "stream";

import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import Excel from "exceljs";
import { isEmpty } from "lodash";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { S3Service } from "src/s3/s3.service";

import {
  MAX_FILE_SIZE,
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  ALLOWED_MIME_TYPES,
} from "./file.constants";
import { FileGuard } from "./guards/file.guard";

import type { FileValidationOptions } from "./guards/file.guard";
import type { ExcelHyperlinkCell } from "./types/excel";
import type { Static, TSchema } from "@sinclair/typebox";

@Injectable()
export class FileService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async getFileUrl(fileKey: string): Promise<string> {
    if (!fileKey) return "https://app.lms.localhost/app/assets/placeholders/card-placeholder.jpg";
    if (fileKey.startsWith("https://")) return fileKey;
    if (fileKey.startsWith("bunny-")) {
      const videoId = fileKey.replace("bunny-", "");

      return this.bunnyStreamService.getUrl(videoId);
    }
    return await this.s3Service.getSignedUrl(fileKey);
  }

  async uploadFile(file: Express.Multer.File, resource: string, options?: FileValidationOptions) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException("File upload failed - invalid file data");
    }

    const { type } = await FileGuard.validateFile(
      file,
      options ?? { allowedTypes: ALLOWED_MIME_TYPES, maxSize: MAX_FILE_SIZE },
    );

    try {
      if (file.mimetype.startsWith("video/")) {
        const result = await this.bunnyStreamService.upload(file);

        return {
          fileKey: result.fileKey,
          fileUrl: result.fileUrl,
        };
      }

      const fileExtension = file.originalname.split(".").pop();
      const fileKey = `${resource}/${randomUUID()}.${fileExtension}`;

      await this.s3Service.uploadFile(file.buffer, fileKey, type);

      const fileUrl = await this.s3Service.getSignedUrl(fileKey);

      return {
        fileKey,
        fileUrl,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw new ConflictException("Failed to upload file");
    }
  }

  async deleteFile(fileKey: string) {
    try {
      if (fileKey.startsWith("bunny-")) {
        const videoId = fileKey.replace("bunny-", "");
        return await this.bunnyStreamService.delete(videoId);
      }
      return await this.s3Service.deleteFile(fileKey);
    } catch (error) {
      throw new ConflictException("Failed to delete file");
    }
  }

  async parseExcelFile<T extends TSchema>(
    file: Express.Multer.File,
    schema: T,
  ): Promise<Static<T>[]> {
    if (!file) {
      throw new BadRequestException({ message: "files.import.noFileUploaded" });
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException({ message: "files.import.invalidFileData" });
    }

    if (
      !ALLOWED_EXCEL_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_EXCEL_MIME_TYPES)[number])
    ) {
      throw new BadRequestException({ message: "files.import.invalidFileType" });
    }

    const validator = TypeCompiler.Compile(schema);

    const fileStream = Readable.from(file.buffer);
    const workbook = new Excel.Workbook();

    const worksheet =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await workbook.csv.read(fileStream, {
            parserOptions: { delimiter: "," },
          })
        : await workbook.xlsx.read(fileStream).then(() => workbook.worksheets[0]);

    const allSheetValues = worksheet.getSheetValues();
    if (!allSheetValues || allSheetValues.length <= 1)
      throw new BadRequestException({ message: "files.import.fileEmpty" });

    const headers = (allSheetValues[1] as string[]).map((h) => String(h).trim().replace(/\r/, ""));
    const rows = allSheetValues.slice(2);

    const parsedCsvData = rows.map((rowValues) => {
      if (!Array.isArray(rowValues)) return;

      const parsedObject: Record<string, string> = {};

      headers.forEach((header, colIndex) => {
        const normalizedHeader = header.trim();

        const cellValue = rowValues[colIndex];

        if (cellValue && typeof cellValue === "object" && "hyperlink" in cellValue) {
          parsedObject[normalizedHeader] = String((cellValue as ExcelHyperlinkCell).hyperlink)
            .replace(/^mailto:/, "")
            .trim();

          return;
        }

        if (!isEmpty(cellValue)) parsedObject[normalizedHeader] = String(cellValue).trim();
      });

      if (!validator.Check(parsedObject))
        throw new BadRequestException({
          message: "files.import.requiredDataMissing",
        });

      return parsedObject as Static<T>;
    });

    return parsedCsvData;
  }
}
