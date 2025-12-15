import { randomUUID } from "crypto";
import { Readable } from "stream";

import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { parse } from "csv-parse";
import readXlsxFile from "read-excel-file/node";
import sharp from "sharp";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { isEmptyObject, normalizeCellValue, normalizeHeader } from "src/file/utils/excel.utils";
import { S3Service } from "src/s3/s3.service";

import {
  MAX_FILE_SIZE,
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  ALLOWED_MIME_TYPES,
} from "./file.constants";
import { FileGuard } from "./guards/file.guard";

import type { FileValidationOptions } from "./guards/file.guard";
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

  async getFileBuffer(fileKey: string): Promise<Buffer | null> {
    if (!fileKey) return null;

    try {
      if (fileKey.startsWith("https://") || fileKey.startsWith("http://")) {
        const response = await fetch(fileKey);

        if (!response.ok) {
          throw new Error(`Failed to download remote file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return sharp(Buffer.from(arrayBuffer), { density: 300 }).toBuffer();
      }

      const buffer = await this.s3Service.getFileBuffer(fileKey);
      return sharp(buffer, { density: 300 }).toBuffer();
    } catch (error) {
      return null;
    }
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

  async getFileStream(fileKey: string) {
    try {
      return await this.s3Service.getFileStream(fileKey);
    } catch (error) {
      throw new BadRequestException("Failed to retrieve file");
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

    const rows =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await this.readCsvToRows(fileStream)
        : await readXlsxFile(file.buffer, { sheet: 1 });

    if (!rows || rows.length <= 1)
      throw new BadRequestException({ message: "files.import.fileEmpty" });

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const parsed = dataRows.map((rowValues) => {
      if (!Array.isArray(rowValues)) return;

      const parsedObject: Record<string, string | string[]> = {};

      headers.forEach((header, colIndex) => {
        if (!header) return;

        const v = normalizeCellValue(header, rowValues[colIndex]);
        if (v !== undefined) parsedObject[header] = v;
      });

      if (isEmptyObject(parsedObject)) return null;

      const schemaKeys = Object.keys(schema.properties || {});
      const filteredObject = Object.fromEntries(
        Object.entries(parsedObject).filter(([key]) => schemaKeys.includes(key)),
      );

      if (!validator.Check(filteredObject)) {
        throw new BadRequestException({
          message: "files.import.requiredDataMissing",
        });
      }

      return validator.Encode(filteredObject) as Static<T>;
    });

    return parsed.filter((item) => item !== null);
  }

  async readCsvToRows(input: Readable, delimiter = ","): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      const rows: any[][] = [];
      input
        .pipe(
          parse({
            delimiter,
            relax_quotes: true,
            bom: true,
            trim: true,
            skip_empty_lines: true,
          }),
        )
        .on("data", (row) => rows.push(row))
        .on("end", () => resolve(rows))
        .on("error", reject);
    });
  }
}
